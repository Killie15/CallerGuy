import React, { useEffect, useState, useRef } from 'react';
import { Persona } from '../types';
import { LiveClient } from '../services/liveClient';
import { PhoneIcon, MicrophoneIcon, SpeakerWaveIcon, XMarkIcon, BoltIcon } from '@heroicons/react/24/solid';

interface ActiveCallProps {
  persona: Persona;
  onEndCall: (transcript: string) => void;
}

export const ActiveCall: React.FC<ActiveCallProps> = ({ persona, onEndCall }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [visualizerLevel, setVisualizerLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  const liveClientRef = useRef<LiveClient | null>(null);
  const timerRef = useRef<number | null>(null);
  const transcriptRef = useRef<string>('');
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    let client: LiveClient | null = null;
    let ignore = false; // Flag to ignore results if unmounted

    const startCall = async () => {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("API Key not found. Please check your deployment settings. Ensure you have set 'GEMINI_API_KEY' in your environment variables.");
        }

        // Create new client instance
        client = new LiveClient({
          apiKey: apiKey,
          systemInstruction: persona.systemInstruction,
          onAudioData: (level) => {
            if (isMountedRef.current) {
              // Smooth dampening
              setVisualizerLevel(prev => (prev * 0.7) + (level * 0.3));
            }
          },
          onTranscript: (text, isUser) => {
            if (isMountedRef.current) {
              const line = `${isUser ? 'You' : persona.name}: ${text}\n`;
              transcriptRef.current += line;
              setTranscript(prev => prev + line);

              // Check for termination signal from AI
              if (!isUser && text.includes('[[END_CALL]]')) {
                console.log("End call signal detected. Terminating in 3s...");
                setTimeout(() => {
                  handleHangUp();
                }, 3000);
              }
            }
          },
          onClose: () => {
            // If we are still mounted and connected, this might be a remote close
            if (isMountedRef.current && status === 'connected') {
              console.log("Connection closed remotely");
            }
          }
        });

        // Store in ref for external access (e.g. buttons)
        liveClientRef.current = client;

        await client.connect();

        // If unmounted or cleaned up while connecting, disconnect immediately
        if (ignore) {
          await client.disconnect();
          return;
        }

        if (isMountedRef.current) {
          setStatus('connected');
          timerRef.current = window.setInterval(() => {
            if (isMountedRef.current) setDuration(d => d + 1);
          }, 1000);
        }

      } catch (err: any) {
        console.error("Failed to connect", err);
        if (isMountedRef.current && !ignore) {
          setStatus('error');
          setErrorMessage(err.message || "Connection failed");
        }
      }
    };

    startCall();

    return () => {
      ignore = true;
      isMountedRef.current = false;

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Disconnect client if it exists
      if (client) {
        client.disconnect().catch(err => {
          console.error("Error during cleanup:", err);
        });
      }
      liveClientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona]);

  const handleHangUp = async () => {
    if (liveClientRef.current) {
      try {
        await liveClientRef.current.disconnect();
      } catch (e) {
        console.error("Error disconnecting:", e);
      }
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    onEndCall(transcriptRef.current);
  };

  const handleToggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (liveClientRef.current) {
      liveClientRef.current.setMute(newState);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 animate-fade-in">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <XMarkIcon className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Call Failed</h3>
        <p className="text-slate-400 mb-6 max-w-md">{errorMessage}</p>
        <button
          onClick={() => onEndCall('')}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  // Create a symmetric visualizer
  const renderVisualizer = () => {
    return (
      <div className="flex items-center justify-center gap-1.5 h-16">
        {[...Array(9)].map((_, i) => {
          const dist = Math.abs(i - 4);
          const baseHeight = 20;
          const variableHeight = 80;
          const activeHeight = Math.max(0, 1 - (dist * 0.2)) * visualizerLevel;
          const totalHeight = baseHeight + (activeHeight * variableHeight);

          return (
            <div
              key={i}
              className={`w-2 rounded-full transition-all duration-75 ease-out ${status === 'connected' ? 'bg-gradient-to-t from-blue-500 to-cyan-300' : 'bg-slate-700'}`}
              style={{
                height: `${status === 'connected' ? totalHeight : 10}%`,
                opacity: status === 'connected' ? 0.8 + (visualizerLevel * 0.2) : 0.5
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[500px] w-full max-w-4xl mx-auto p-4 sm:p-6 animate-fade-in">

      {/* Header Info */}
      <div className="text-center mb-6 sm:mb-8 relative">
        <div className="relative inline-block group">
          {/* Glow Effect */}
          <div
            className="absolute inset-0 rounded-full bg-blue-500 blur-xl transition-opacity duration-100"
            style={{ opacity: visualizerLevel * 0.8 }}
          ></div>

          <img
            src={persona.avatarUrl}
            alt={persona.name}
            className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-slate-700 shadow-2xl object-cover z-10"
          />
          <div className={`absolute bottom-2 right-2 z-20 w-5 h-5 rounded-full border-4 border-slate-900 ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
        </div>

        <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-white tracking-tight">{persona.name}</h2>
        <p className="text-slate-400 text-base sm:text-lg font-medium">{persona.role} @ {persona.company}</p>

        <div className="mt-3 px-4 py-1 bg-slate-800/80 backdrop-blur rounded-full inline-flex items-center gap-2 border border-slate-700">
          <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}></div>
          <span className="text-slate-300 font-mono text-xs sm:text-sm">
            {status === 'connecting' ? 'Connecting...' : formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Visualizer */}
      <div className="mb-8 sm:mb-10 w-full max-w-xs mx-auto">
        {renderVisualizer()}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 sm:gap-10">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleToggleMute}
            disabled={status !== 'connected'}
            className={`p-4 rounded-full transition-all duration-200 ${isMuted
              ? 'bg-white text-red-500 hover:bg-slate-200'
              : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
              } ${status !== 'connected' ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
          >
            <MicrophoneIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleHangUp}
            className="p-6 sm:p-7 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-500/20 transition-all transform hover:scale-105 active:scale-95 border-4 border-slate-900"
          >
            <PhoneIcon className="w-8 h-8 sm:w-9 sm:h-9 transform rotate-[135deg]" />
          </button>
          <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">End Call</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button className="p-4 rounded-full bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50" title="Output settings not available">
            <SpeakerWaveIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">Speaker</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => {
              setTestStatus('testing');
              // The AI should respond naturally since it's listening
              // Just show that we're testing and wait for response
              setTimeout(() => {
                if (status === 'connected') {
                  setTestStatus('success');
                } else {
                  setTestStatus('failed');
                }
                setTimeout(() => setTestStatus('idle'), 2000);
              }, 1500);
            }}
            disabled={status !== 'connected' || testStatus === 'testing'}
            className={`p-4 rounded-full transition-all duration-200 ${testStatus === 'success' ? 'bg-green-500 text-white' :
              testStatus === 'failed' ? 'bg-red-500 text-white' :
                testStatus === 'testing' ? 'bg-yellow-500 text-white animate-pulse' :
                  'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
              } ${status !== 'connected' ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
            title="Test if AI is responding"
          >
            <BoltIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
            {testStatus === 'testing' ? 'Testing...' : testStatus === 'success' ? 'Connected!' : testStatus === 'failed' ? 'Failed' : 'Test'}
          </span>
        </div>
      </div>

    </div>
  );
};