import React from 'react';
import { CallSession } from '../types';
import { TrophyIcon, CalendarIcon } from '@heroicons/react/24/solid';

interface LeaderboardProps {
  sessions: CallSession[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ sessions }) => {
  // Sort by score desc, then timestamp desc
  const sorted = [...sessions].sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    return b.timestamp - a.timestamp;
  });

  return (
    <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden flex flex-col shadow-lg max-h-[400px]">
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/60 flex items-center gap-3 flex-shrink-0">
        <div className="p-1.5 bg-yellow-500/10 rounded-lg">
           <TrophyIcon className="w-4 h-4 text-yellow-500" />
        </div>
        <h3 className="text-sm font-bold text-white">Leaderboard</h3>
      </div>
      
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center flex-grow">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-2">
             <TrophyIcon className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium text-sm">No calls yet</p>
          <p className="text-slate-500 text-xs mt-1">Be the first to hit the board!</p>
        </div>
      ) : (
        <div className="overflow-y-auto custom-scrollbar flex-grow">
          {sorted.map((s, idx) => (
            <div 
              key={s.id} 
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
                  <p className="font-semibold text-slate-200 truncate text-xs sm:text-sm">{s.playerName}</p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <CalendarIcon className="w-3 h-3" />
                    <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 ml-2">
                <span className={`text-sm sm:text-base font-bold ${s.overallScore >= 80 ? 'text-green-400' : s.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {s.overallScore}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};