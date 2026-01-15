import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from "../utils/audioUtils";

interface LiveClientConfig {
  apiKey: string;
  systemInstruction: string;
  onAudioData: (visualizerValue: number) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onClose: () => void;
}

export class LiveClient {
  private client: GoogleGenAI;
  private config: LiveClientConfig;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private stream: MediaStream | null = null;
  private sessionPromise: Promise<any> | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isConnected = false;
  private audioQueue: AudioBufferSourceNode[] = [];

  constructor(config: LiveClientConfig) {
    console.log("[LiveClient] Initializing...");
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async connect() {
    if (this.isConnected) {
      console.warn("[LiveClient] Already connected.");
      return;
    }

    console.log("[LiveClient] Connecting...");
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("AudioContext not supported in this browser");
    }

    // Remove hardcoded sampleRate to prevent crashes on iOS/Safari
    this.inputAudioContext = new AudioContextClass();
    this.outputAudioContext = new AudioContextClass();

    // Resume contexts if they are suspended (browser policy)
    await this.inputAudioContext.resume();
    await this.outputAudioContext.resume();
    console.log("[LiveClient] AudioContexts resumed");

    // Add echo cancellation and noise suppression
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log("[LiveClient] Microphone access granted");
    } catch (e) {
      console.error("[LiveClient] Microphone access denied", e);
      throw e;
    }

    this.sessionPromise = this.client.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: this.handleOpen.bind(this),
        onmessage: this.handleMessage.bind(this),
        onclose: this.handleClose.bind(this),
        onerror: (e) => { console.error("[LiveClient] Live API Error", e); this.config.onClose(); },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.config.systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        }
      },
    });

    // Await the session to ensure connection is established and catch initial errors (like 403)
    try {
      await this.sessionPromise;
      console.log("[LiveClient] Session established successfully");
      this.isConnected = true;
    } catch (e) {
      console.error("[LiveClient] Failed to establish session", e);
      throw e;
    }
  }

  private handleOpen() {
    console.log("[LiveClient] WebSocket Opened");
    if (!this.inputAudioContext || !this.stream || !this.sessionPromise) return;

    this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.stream);
    // Reduced buffer size to 2048 for lower latency (approx 128ms)
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      // CRITICAL FIX: Ensure context exists before accessing properties
      if (!this.inputAudioContext) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Simple volume calculation for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      // Determine if we should visualize this frame (user speaking)
      if (rms > 0.01) {
        // Pass a value 0-1
        this.config.onAudioData(Math.min(1, rms * 5));
      }

      // Pass the actual sample rate of the context so Gemini knows how to handle it
      const pcmBlob = createPcmBlob(inputData, this.inputAudioContext.sampleRate);

      // Catch potential errors in the promise chain to prevent "Uncaught (in promise)"
      this.sessionPromise?.then(session => {
        session.sendRealtimeInput({ media: pcmBlob });
      }).catch(err => {
        // Log gently, as this can happen during shutdown/disconnect
        console.debug("[LiveClient] Error sending audio frame:", err);
      });
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    try {
      if (!this.outputAudioContext) return;

      // Handle Transcript
      if (message.serverContent?.inputTranscription) {
        console.log("[LiveClient] Input Transcript:", message.serverContent.inputTranscription.text);
        this.config.onTranscript(message.serverContent.inputTranscription.text, true);
      }
      if (message.serverContent?.outputTranscription) {
        console.log("[LiveClient] Output Transcript:", message.serverContent.outputTranscription.text);
        this.config.onTranscript(message.serverContent.outputTranscription.text, false);
      }

      // Handle Audio
      const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
      if (base64Audio) {
        const audioData = base64ToUint8Array(base64Audio);

        // Visualize model audio
        let sum = 0;
        // Sample a few points from the raw int16 data for visualizer
        const int16 = new Int16Array(audioData.buffer);
        for (let i = 0; i < int16.length; i += 10) {
          const val = int16[i] / 32768.0;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / (int16.length / 10));
        this.config.onAudioData(Math.min(1, rms * 5));

        // Decode - output is always 24k from Gemini 2.5 Live
        const audioBuffer = await decodeAudioData(
          audioData,
          this.outputAudioContext,
          24000,
          1
        );

        // Drift Correction
        if (this.nextStartTime < this.outputAudioContext.currentTime) {
          this.nextStartTime = this.outputAudioContext.currentTime;
        }

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);

        // Track the source for interruption handling
        source.onended = () => {
          const index = this.audioQueue.indexOf(source);
          if (index > -1) {
            this.audioQueue.splice(index, 1);
          }
        };
        this.audioQueue.push(source);

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
      }

      // Handle Interruption
      if (message.serverContent?.interrupted) {
        console.log("[LiveClient] Interruption Detected");
        // Stop all currently playing audio immediately
        this.audioQueue.forEach(source => {
          try {
            source.stop();
          } catch (e) {
            // Ignore errors if source already stopped
          }
        });
        this.audioQueue = []; // Clear queue

        // Reset timing cursor to now
        this.nextStartTime = this.outputAudioContext.currentTime;
      }
    } catch (e) {
      console.error("[LiveClient] Error processing message", e);
    }
  }

  setMute(mute: boolean) {
    if (this.stream) {
      console.log(`[LiveClient] Mute set to: ${mute}`);
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !mute;
      });
    }
  }

  private handleClose() {
    console.log("[LiveClient] Connection Closed");
    this.isConnected = false;
    this.config.onClose();
  }

  async disconnect() {
    console.log("[LiveClient] Disconnecting...");
    // Stop any playing audio
    this.audioQueue.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    this.audioQueue = [];

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    if (this.sessionPromise) {
      // Wrap in try-catch to handle if the session promise was rejected (failed connection)
      try {
        const session = await this.sessionPromise;
        if (session && typeof (session as any).close === 'function') {
          (session as any).close();
        }
      } catch (e) {
        // Silently ignore if session failed to connect, as we are cleaning up anyway
      }
      this.sessionPromise = null;
    }

    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      try {
        await this.inputAudioContext.close();
      } catch (e) {
        console.warn("[LiveClient] Input AudioContext close error", e);
      }
    }
    this.inputAudioContext = null;

    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      try {
        await this.outputAudioContext.close();
      } catch (e) {
        console.warn("[LiveClient] Output AudioContext close error", e);
      }
    }
    this.outputAudioContext = null;

    this.isConnected = false;
    console.log("[LiveClient] Disconnected");
  }
}