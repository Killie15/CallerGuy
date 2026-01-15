import React, { useEffect, useState } from 'react';
import { TrophyIcon, CalendarIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { getLeaderboard, LeaderboardEntry } from '../services/supabaseClient';

interface LeaderboardProps {
  fullscreen?: boolean;
  onClose?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ fullscreen = false, onClose }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);

    // 1. Fetch Global from Supabase
    let globalData: LeaderboardEntry[] = [];
    try {
      globalData = await getLeaderboard(20);
    } catch (e) {
      console.warn("Failed to fetch global leaderboard", e);
    }

    // 2. Fetch Local History
    let localData: LeaderboardEntry[] = [];
    try {
      const saved = localStorage.getItem('coldcall_sessions');
      if (saved) {
        const sessions = JSON.parse(saved);
        // Map CallSession to LeaderboardEntry
        localData = sessions.map((s: any) => ({
          id: s.id,
          player_name: s.playerName,
          persona_id: s.personaId,
          score: s.overallScore,
          summary: s.summary,
          created_at: new Date(s.timestamp).toISOString()
        }));
      }
    } catch (e) {
      console.warn("Failed to parse local history", e);
    }

    // 3. Merge & Sort
    const combined = [...globalData, ...localData];
    combined.sort((a, b) => b.score - a.score);
    setEntries(combined.slice(0, 20));
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div className={`bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden flex flex-col shadow-lg ${fullscreen ? 'fixed inset-4 z-50 max-h-none' : 'max-h-[400px]'}`}>
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/60 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-yellow-500/10 rounded-lg">
            <TrophyIcon className="w-4 h-4 text-yellow-500" />
          </div>
          <h3 className="text-sm font-bold text-white">{fullscreen ? 'Global Leaderboard' : 'Leaderboard'}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <ArrowPathIcon className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {fullscreen && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
              title="Close"
            >
              <XMarkIcon className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center flex-grow">
          <ArrowPathIcon className="w-6 h-6 text-slate-500 animate-spin mb-2" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center flex-grow">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-2">
            <TrophyIcon className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium text-sm">No calls yet</p>
          <p className="text-slate-500 text-xs mt-1">Be the first to hit the board!</p>
        </div>
      ) : (
        <div className="overflow-y-auto custom-scrollbar flex-grow">
          {entries.map((entry, idx) => (
            <div key={entry.id || idx}
              className={`
                flex items-center justify-between p-3 border-b border-slate-700/30 transition-colors
                ${idx < 3 ? 'bg-slate-800/20' : 'hover:bg-slate-800/30'}
              `}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`
                  flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md font-bold text-xs
                  ${idx === 0 ? 'bg-yellow-500 text-yellow-950 shadow-lg shadow-yellow-500/20' :
                    idx === 1 ? 'bg-slate-300 text-slate-900' :
                      idx === 2 ? 'bg-orange-400 text-orange-950' :
                        'bg-slate-700 text-slate-400'}
                `}>
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 truncate text-xs sm:text-sm">
                    {entry.player_name} - <span className="text-slate-400 font-normal">{entry.persona_id === 'p1' ? 'Mr. Johnson/Location' : entry.persona_id === 'p2' ? 'Ms. Davis/Quality' : entry.persona_id === 'p3' ? 'Mrs. Smith/Meal' : entry.persona_id}</span>
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <CalendarIcon className="w-3 h-3" />
                    <span>
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleDateString() + ' ' + new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Just now'}
                    </span>
                  </div>
                  {entry.score >= 80 && entry.summary && (
                    <div className="mt-1 p-2 bg-green-500/10 border border-green-500/20 rounded text-[10px] text-green-300 italic">
                      ⭐ "{entry.summary}"
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 ml-2">
                <span className={`text-sm sm:text-base font-bold ${entry.score >= 80 ? 'text-green-400' : entry.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {entry.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};