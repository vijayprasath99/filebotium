import React, { useEffect, useState } from 'react';
import { Preset, presetApi } from '../api/client';
import { ProviderType, MatchingMode, LanguageCode, FileAction } from '../types';
import { X, Trash2, Save, Play } from 'lucide-react';

interface CurrentConfig {
  formatExpression: string;
  provider: ProviderType;
  mode: MatchingMode;
  language: LanguageCode;
  action: FileAction;
}

interface PresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: CurrentConfig;
  onApplyPreset: (preset: Preset) => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onApplyPreset,
}) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPresets = () => {
    setIsLoading(true);
    presetApi
      .listPresets()
      .then(setPresets)
      .catch(() => setError('Failed to load presets from backend.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadPresets();
      setNewName('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCurrent = async () => {
    if (!newName.trim()) return;
    try {
      await presetApi.savePreset({
        name: newName.trim(),
        formatExpression: currentConfig.formatExpression,
        provider: currentConfig.provider,
        mode: currentConfig.mode,
        language: currentConfig.language,
        action: currentConfig.action,
      });
      setNewName('');
      loadPresets();
    } catch {
      setError('Failed to save preset.');
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete preset "${name}"?`)) return;
    try {
      await presetApi.deletePreset(name);
      loadPresets();
    } catch {
      setError('Failed to delete preset.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        <div className="px-4 py-2 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Preset Manager</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {error && (
            <div className="text-xs bg-red-950/40 border border-red-800/60 text-red-300 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Save current config as a new preset */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New preset name..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleSaveCurrent}
              disabled={!newName.trim()}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
              title="Save the current Rename workspace configuration (format, provider, mode, language, action) as a new preset"
            >
              <Save className="w-3.5 h-3.5" />
              Save Current
            </button>
          </div>

          {/* Preset list */}
          <div className="max-h-72 overflow-y-auto border border-slate-800 rounded divide-y divide-slate-800">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-500">Loading...</div>
            ) : presets.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No presets saved yet. Configure the Rename workspace and save it above.
              </div>
            ) : (
              presets.map((preset, idx) => (
                <div key={preset.name} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800/50">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      {idx < 9 && (
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-1 rounded font-mono">
                          {idx + 1}
                        </span>
                      )}
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      {preset.formatExpression || '(no format)'} · {preset.mode || '-'} · {preset.provider || '-'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        onApplyPreset(preset);
                        onClose();
                      }}
                      className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                      title="Apply this preset"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(preset.name)}
                      className="p-1.5 bg-slate-800 hover:bg-red-950/50 text-slate-400 hover:text-red-400 rounded transition-colors"
                      title="Delete this preset"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            Tip: while the Rename workspace is focused, press 1-9 to instantly apply one of the first
            9 presets above.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PresetManagerModal;
