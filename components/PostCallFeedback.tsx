import React from 'react';
import { CallSession, RubricItem } from '../types';
import { StarIcon } from '@heroicons/react/24/solid';
import { ArrowPathIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface PostCallFeedbackProps {
  session: CallSession;
  onBackToDashboard: () => void;
}

export const PostCallFeedback: React.FC<PostCallFeedbackProps> = ({ session, onBackToDashboard }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const chartData = [
    { name: 'Score', value: session.overallScore },
    { name: 'Missed', value: 100 - session.overallScore }
  ];
  const COLORS = [session.overallScore >= 70 ? '#4ade80' : '#f87171', '#1e293b'];

  return (
    <div className="max-w-5xl mx-auto p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <ClipboardDocumentListIcon className="w-8 h-8 text-blue-500" />
          Call Analysis
        </h2>
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Practice Again
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Overall Score Card */}
        <div className="col-span-1 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
          <h3 className="text-slate-400 font-medium mb-4 uppercase tracking-widest text-sm">Overall Score</h3>

          <div className="h-48 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className={`text-5xl font-bold ${getScoreColor(session.overallScore)}`}>
                {session.overallScore}
              </span>
              <span className="text-slate-500 text-sm">/ 100</span>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="col-span-1 md:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium uppercase tracking-widest text-sm">Coach's Summary</h3>
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
            >
              <ArrowPathIcon className="w-5 h-5" />
              Practice Again
            </button>
          </div>
          <p className="text-slate-200 leading-relaxed text-lg">
            {session.summary}
          </p>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <h4 className="text-sm font-semibold text-slate-400 mb-2">Transcript Snippet</h4>
            <div className="bg-slate-900 p-4 rounded-lg h-32 overflow-y-auto text-sm text-slate-400 font-mono">
              {session.transcript || "No transcript recorded."}
            </div>
          </div>
        </div>
      </div>

      {/* Rubric Breakdown */}
      <h3 className="text-xl font-bold text-white mb-4">Detailed Rubric</h3>
      <div className="grid grid-cols-1 gap-4">
        {session.rubric.map((item, idx) => (
          <div key={idx} className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-4 md:items-center">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-200">{item.category}</h4>
                <div className="flex items-center gap-1">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-6 rounded-sm ${i < item.score ? (item.score > 7 ? 'bg-green-500' : 'bg-yellow-500') : 'bg-slate-700'}`}
                    ></div>
                  ))}
                  <span className="ml-2 text-white font-bold">{item.score}/10</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm">{item.feedback}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
