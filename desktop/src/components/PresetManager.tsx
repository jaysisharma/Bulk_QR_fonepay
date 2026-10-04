import { useState } from 'react';
import { Bookmark, Trash2, Check, Sparkles, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { PresetItem } from '../types';

interface PresetManagerProps {
  presets: PresetItem[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: PresetItem) => void;
  onDeletePreset: (id: string) => void;
  onResetToDefault: () => void;
  currentDims: { width: number; height: number; x: number; y: number };
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  presets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  currentDims,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleSave = () => {
    const name = presetName.trim() || `Layout ${presets.length + 1}`;
    onSavePreset(name);
    setPresetName('');
    setShowInput(false);
  };

  return (
    <div className="border border-slate-800/80 rounded-xl bg-slate-900/30 overflow-hidden text-xs">
      {/* Compact Collapsible Header */}
      <div className="flex items-center justify-between p-2.5 hover:bg-slate-900/50 transition">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-slate-300 font-medium cursor-pointer"
        >
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
          <span>Presets</span>
          {presets.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300">
              {presets.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setIsOpen(true);
            setShowInput(true);
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-[11px]"
        >
          <Plus className="w-3 h-3" />
          <span>Save Current</span>
        </button>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-2.5 pt-0 space-y-2 border-t border-slate-800/60 mt-1">
          {showInput && (
            <div className="flex items-center gap-1.5 pt-2">
              <input
                type="text"
                placeholder="Preset Name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setShowInput(false);
                }}
                autoFocus
                className="flex-1 bg-slate-950 border border-indigo-500/50 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
              />
              <button
                onClick={handleSave}
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {presets.length === 0 && !showInput && (
            <p className="text-[11px] text-slate-500 py-1 italic text-center">
              No saved presets. Click &quot;Save Current&quot; to save this layout.
            </p>
          )}

          {presets.length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1 pt-1">
              {presets.map((preset) => {
                const isMatch =
                  Math.abs(preset.qrWidth - currentDims.width) < 0.01 &&
                  Math.abs(preset.qrHeight - currentDims.height) < 0.01 &&
                  Math.abs(preset.qrX - currentDims.x) < 0.01 &&
                  Math.abs(preset.qrY - currentDims.y) < 0.01;

                return (
                  <div
                    key={preset.id}
                    className={`flex items-center justify-between p-1.5 rounded border text-xs transition ${
                      isMatch
                        ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                        : 'bg-slate-950/40 border-slate-800/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => onApplyPreset(preset)}
                      className="flex-1 text-left flex items-center gap-1.5 min-w-0 cursor-pointer"
                    >
                      {isMatch && <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />}
                      <span className="truncate">{preset.name}</span>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {preset.qrWidth}&quot;×{preset.qrHeight}&quot;
                      </span>
                    </button>

                    <button
                      onClick={() => onDeletePreset(preset.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer shrink-0 ml-1"
                      title="Delete preset"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
