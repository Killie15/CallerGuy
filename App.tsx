import React, { useState, useEffect, useRef, Component, type ReactNode, type ErrorInfo } from 'react';
import { getPersonas, gradeCall, validateApiKey } from './services/geminiService';
import { Persona, CallSession, AppState, Language } from './types';
import { PersonaCard } from './components/PersonaCard';
import { ActiveCall } from './components/ActiveCall';
import { PostCallFeedback } from './components/PostCallFeedback';
import { Leaderboard } from './components/Leaderboard';
import { PhoneIcon, ShareIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { UserIcon, BoltIcon } from '@heroicons/react/24/solid';

console.log("[App.tsx] Module loaded");

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary Component
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-slate-400 mb-6 max-w-md">
            The application encountered an unexpected error.
          </p>
          <div className="bg-slate-800 p-4 rounded-lg text-left font-mono text-xs text-red-300 overflow-auto max-w-xl w-full mb-6 border border-red-500/20">
            {this.state.error?.toString()}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors shadow-lg shadow-blue-600/20"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.DASHBOARD);
  const [language, setLanguage] = useState<Language>('en');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [playerName, setPlayerName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState(true);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialization
  useEffect(() => {
    console.log("[App] Component Mounted. Initializing...");

    // Check API Key immediately
    const valid = validateApiKey();
    console.log(`[App] API Key Check: ${valid ? 'VALID' : 'MISSING'}`);
    setApiKeyValid(valid);

    // Load history safely
    try {
      const saved = localStorage.getItem('coldcall_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`[App] Loaded ${parsed.length} sessions from local storage`);
        setSessions(parsed);
      } else {
        console.log("[App] No previous sessions found in local storage");
      }
    } catch (e) {
      console.error("[App] Failed to parse sessions from local storage", e);
      // Optionally clear corrupted data
      localStorage.removeItem('coldcall_sessions');
    }

    // Load player name
    const savedName = localStorage.getItem('coldcall_playername');
    if (savedName) {
      console.log(`[App] Loaded player name: ${savedName}`);
      setPlayerName(savedName);
    }

    // Check URL params for shared persona and language
    try {
      const url = new URL(window.location.href);
      console.log(`[App] Checking URL parameters: ${url.search}`);
      // Guard against blob URLs which might fail search param access
      if (url.protocol !== 'blob:') {
        const params = url.searchParams;
        const personaId = params.get('personaId');
        const langParam = params.get('lang');

        // Set language first
        const currentLang = (langParam === 'ja') ? 'ja' : 'en';
        if (langParam === 'ja') {
          console.log("[App] Setting language to Japanese via URL param");
          setLanguage('ja');
        }

        // Fetch personas for the correct language
        const currentPersonas = getPersonas(currentLang);

        if (personaId) {
          const persona = currentPersonas.find(p => p.id === personaId);
          if (persona) {
            console.log(`[App] Selecting persona ${persona.name} via URL param`);
            setSelectedPersona(persona);
          } else {
            console.warn(`[App] Persona ID ${personaId} not found`);
          }
        }
      }
    } catch (e) {
      console.warn("[App] Error parsing URL parameters", e);
    }
  }, []);

  // Helper to safely update URL without crashing in sandboxes/blobs
  const updateUrl = (newParams: Record<string, string | null>) => {
    try {
      const url = new URL(window.location.href);
      // Guard against blob URLs which might fail URL construction or pushState
      if (url.protocol === 'blob:') return;

      Object.entries(newParams).forEach(([key, value]) => {
        if (value === null) {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, value);
        }
      });
      window.history.pushState({}, '', url);
    } catch (e) {
      // Ignore security errors in restricted environments
      console.debug("[App] URL update suppressed due to environment restrictions", e);
    }
  };

  const handleStartCall = () => {
    console.log("[App] Attempting to start call...");
    if (!selectedPersona) {
      console.warn("[App] Cannot start call: No persona selected");
      return;
    }

    if (!playerName.trim()) {
      console.warn("[App] Cannot start call: Player name missing");
      if (nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.classList.add('ring-2', 'ring-red-500');
        setTimeout(() => nameInputRef.current?.classList.remove('ring-2', 'ring-red-500'), 2000);
      }
      return;
    }

    console.log(`[App] Starting call with ${selectedPersona.name}, Player: ${playerName}`);
    localStorage.setItem('coldcall_playername', playerName);
    setAppState(AppState.IN_CALL);
  };

  const handleEndCall = async (transcript: string) => {
    if (!selectedPersona) return;

    console.log("[App] Call ended. Processing transcript length:", transcript.length);
    console.log("[App] Transcript preview:", transcript.substring(0, 100) + "...");
    setIsProcessing(true);

    // 1. Grade the call passing the current language
    const grading = await gradeCall(transcript, selectedPersona, language);
    console.log("[App] Grading complete. Score:", grading.score);

    // 2. Create session object
    const newSession: CallSession = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      playerName: playerName,
      personaId: selectedPersona.id,
      durationSeconds: 0,
      transcript: transcript,
      overallScore: grading.score,
      rubric: grading.rubric,
      summary: grading.summary
    };

    // 3. Save
    const newSessions = [newSession, ...sessions];
    setSessions(newSessions);
    localStorage.setItem('coldcall_sessions', JSON.stringify(newSessions));
    setCurrentSession(newSession);

    setIsProcessing(false);
    setAppState(AppState.FEEDBACK);
  };

  const handlePersonaSelect = (persona: Persona) => {
    console.log(`[App] Persona selected: ${persona.name} (${persona.id})`);
    setSelectedPersona(persona);
    // Use safe helper
    updateUrl({ personaId: persona.id, lang: language });
  };

  const copyShareLink = () => {
    try {
      const url = new URL(window.location.href);
      // Guard against blob URLs
      if (url.protocol === 'blob:') {
        console.warn("[App] Cannot generate share link in preview mode");
        return;
      }

      // Ensure current state is in URL
      if (selectedPersona) url.searchParams.set('personaId', selectedPersona.id);
      url.searchParams.set('lang', language);

      navigator.clipboard.writeText(url.toString()).then(() => {
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
      }).catch(err => console.warn("[App] Clipboard write failed", err));
    } catch (e) {
      console.warn("[App] Could not copy link", e);
    }
  };

  const toggleLanguage = (lang: Language) => {
    console.log(`[App] Switching language to ${lang}`);
    setLanguage(lang);
    setSelectedPersona(null); // Deselect when switching languages to avoid mismatch
    setAppState(AppState.DASHBOARD); // Force return to dashboard to avoid blank screen if in call

    // Use safe helper
    updateUrl({ lang: lang, personaId: null });
  };

  const currentPersonas = getPersonas(language);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-900 text-slate-200 selection:bg-blue-500/30 flex flex-col font-sans overflow-x-hidden">

        {/* Navbar */}
        <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 shadow-sm h-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setAppState(AppState.DASHBOARD)}>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:shadow-blue-600/40 transition-all duration-300">
                <BoltIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tight">
                ColdCall AI
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Language Switcher */}
              <div className="flex bg-slate-800/80 rounded-lg p-1 border border-slate-700/50">
                <button
                  onClick={() => toggleLanguage('en')}
                  className={`px-2 py-0.5 text-xs font-semibold rounded cursor-pointer transition-all ${language === 'en' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => toggleLanguage('ja')}
                  className={`px-2 py-0.5 text-xs font-semibold rounded cursor-pointer transition-all ${language === 'ja' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  JP
                </button>
              </div>

              {appState === AppState.DASHBOARD && (
                <button
                  onClick={copyShareLink}
                  className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-700"
                  title="Copy link to clipboard"
                >
                  <ShareIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              )}

              {appState !== AppState.DASHBOARD && playerName && (
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/50">
                  <UserIcon className="w-3 h-3 text-slate-400" />
                  <span>{playerName}</span>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Diagnostic Banner */}
        {!apiKeyValid && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 animate-fade-in">
            <div className="max-w-7xl mx-auto flex items-start sm:items-center gap-3 text-red-400 text-sm">
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="font-bold">API Key Missing</p>
                <p>
                  Please ensure you have set <strong>API_KEY</strong> in your environment variables.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Share Toast */}
        {showShareToast && (
          <div className="fixed top-20 right-4 z-[60] bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-xl animate-fade-in-up flex items-center gap-3 font-medium">
            <div className="bg-white/20 p-1 rounded-full"><ShareIcon className="w-4 h-4" /></div>
            <span>Link copied to clipboard!</span>
          </div>
        )}

        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">

          {/* State: DASHBOARD */}
          {appState === AppState.DASHBOARD && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">

              {/* Main Content */}
              <div className="lg:col-span-8 flex flex-col h-full">
                <div className="mb-4">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
                    {language === 'ja' ? 'シナリオを選択' : 'Select a Scenario'}
                  </h1>
                  <p className="text-slate-400 text-sm max-w-2xl">
                    {language === 'ja'
                      ? '対応するグループリーダーの苦情を選択してください。'
                      : 'Choose a Group Leader complaint scenario to practice resolving.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentPersonas.map(p => (
                    <PersonaCard
                      key={p.id}
                      persona={p}
                      isSelected={selectedPersona?.id === p.id}
                      onSelect={handlePersonaSelect}
                    />
                  ))}
                </div>
              </div>

              {/* Sidebar / Leaderboard / Action Panel */}
              <div className="lg:col-span-4 flex flex-col gap-6">

                {/* Action Panel - Moved here for laptop layout optimization */}
                <div className={`
                 transition-all duration-300
                 bg-slate-800/60 backdrop-blur p-4 rounded-xl border border-slate-700/50 shadow-xl
                 ${selectedPersona ? 'ring-1 ring-blue-500/30' : 'opacity-90'}
               `}>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    {language === 'ja' ? 'セッション設定' : 'Session Setup'}
                  </h3>

                  <div className="space-y-3">
                    <div className="relative group">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-400 transition-colors" />
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder={language === 'ja' ? 'プレイヤー名' : "Enter your name"}
                        className="w-full bg-slate-900/50 text-white rounded-lg py-2.5 pl-9 pr-4 text-sm border border-slate-700/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                      />
                    </div>

                    <button
                      onClick={handleStartCall}
                      disabled={!selectedPersona || !apiKeyValid}
                      className={`
                          w-full py-3 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all transform shadow-lg
                          ${(selectedPersona && apiKeyValid)
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.02] hover:shadow-blue-500/25 cursor-pointer'
                          : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                        }
                        `}
                    >
                      <PhoneIcon className="w-4 h-4" />
                      <span>{language === 'ja' ? 'シミュレーション開始' : 'Start Simulation'}</span>
                    </button>
                  </div>

                  {!selectedPersona && (
                    <p className="text-center text-xs text-slate-500 mt-2">
                      {language === 'ja' ? '← ペルソナを選択してください' : '← Select a persona to start'}
                    </p>
                  )}
                </div>

                <Leaderboard sessions={sessions} />
              </div>
            </div>
          )}

          {/* State: IN_CALL */}
          {appState === AppState.IN_CALL && selectedPersona && (
            <ActiveCall
              persona={selectedPersona}
              onEndCall={handleEndCall}
            />
          )}

          {/* State: FEEDBACK */}
          {appState === AppState.FEEDBACK && currentSession && (
            <PostCallFeedback
              session={currentSession}
              onBackToDashboard={() => setAppState(AppState.DASHBOARD)}
            />
          )}
        </main>

        <footer className="border-t border-slate-800 bg-slate-900/50 py-4 text-center text-slate-600 text-xs">
          <p>© 2025 ColdCall AI. Built with Gemini Multimodal Live API.</p>
        </footer>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-fade-in px-4 text-center">
            <div className="w-16 h-16 relative mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            </div>
            <p className="text-xl font-bold text-white mb-2">
              {language === 'ja' ? '会話を分析中...' : 'Analyzing Conversation...'}
            </p>
            <p className="text-slate-400 max-w-md text-sm">
              {language === 'ja'
                ? 'AIコーチがパフォーマンスを採点し、フィードバックを作成しています。'
                : 'Our AI coach is reviewing the transcript, grading your performance, and generating a detailed scorecard.'}
            </p>
          </div>
        )}

      </div>
    </ErrorBoundary>
  );
}

export default App;