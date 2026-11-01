import React from 'react';
import { CARD_OPTIONS, type CardOptionId, type CardOptionSize } from '../types';

interface CardOptionToggleProps {
  activeOption: CardOptionId;
  optionSizes: Record<CardOptionId, CardOptionSize>;
  onChange: (option: CardOptionId) => void;
}

/**
 * Switches between saved card setups. Each option keeps its own card size,
 * template, and bulk sheet grid.
 */
export const CardOptionToggle: React.FC<CardOptionToggleProps> = ({ activeOption, optionSizes, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
      {CARD_OPTIONS.map((option) => {
        const size = optionSizes[option.id];
        const isActive = activeOption === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`py-1.5 px-1 rounded text-center transition cursor-pointer ${
              isActive
                ? 'bg-indigo-600/25 border border-indigo-500/50 text-indigo-100 shadow-xs'
                : 'border border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="text-[11px] font-semibold">{option.label}</div>
            <div className="text-[9px] font-mono text-slate-400">
              {size.cardWidth}&quot; × {size.cardHeight}&quot;
            </div>
          </button>
        );
      })}
    </div>
  );
};
