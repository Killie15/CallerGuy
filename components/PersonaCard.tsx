import React from 'react';
import { Persona } from '../types';

interface PersonaCardProps {
  persona: Persona;
  onSelect: (persona: Persona) => void;
  isSelected?: boolean;
}

const difficultyColor = {
  'Easy': 'text-green-400 border-green-400/30 bg-green-400/10',
  'Normal': 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  'Medium': 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  'Hard': 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  'Expert': 'text-red-500 border-red-500/30 bg-red-500/10',
};

export const PersonaCard: React.FC<PersonaCardProps> = ({ persona, onSelect, isSelected }) => {
  return (
    <div
      onClick={() => onSelect(persona)}
      className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg group
        ${isSelected
          ? 'border-blue-500 bg-slate-800 shadow-blue-500/20'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
        }
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          <img src={persona.avatarUrl} alt={persona.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-600" />
          <div>
            <h3 className="text-lg font-bold text-white">{persona.name}</h3>
            <p className="text-slate-400 text-sm">{persona.role} @ {persona.company}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-semibold border ${difficultyColor[persona.difficulty]}`}>
          {persona.difficulty}
        </span>
      </div>

      <p className="text-slate-300 text-sm mb-4 line-clamp-2">
        {persona.description}
      </p>

      <div className="space-y-2">
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Potential Objections</p>
        <div className="flex flex-wrap gap-2">
          {persona.objections.map((obj, i) => (
            <span key={i} className="text-xs bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-700">
              "{obj}"
            </span>
          ))}
        </div>
      </div>

      {isSelected && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-500 pointer-events-none animate-pulse opacity-50"></div>
      )}
    </div>
  );
};
