import React, { useEffect, useState } from 'react';
import { AppSettings, FileAction, LanguageCode } from '../types';
import { settingsApi } from '../api/client';
import { Settings, Save } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    defaultLanguage: 'EN',
    defaultAction: 'MOVE',
    tvFormat: '{n} - {s00e00} - {t}',
    movieFormat: '{n} ({y})/{n} ({y})',
    musicFormat: '{artist} - {album}/{pi} - {t}',
    animeFormat: '{n} - {absolute} - {t}',
    filterHiddenFiles: true,
    recursiveSearch: true,
  });

  useEffect(() => {
    settingsApi.getSettings().then(setSettings).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await settingsApi.updateSettings(settings);
      alert('Settings saved successfully!');
    } catch (err) {
      alert('Error saving settings');
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 bg-slate-950 text-slate-100 overflow-auto">
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-200">Application Settings & Preferences</h2>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">General Defaults</h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Default Action</label>
            <select
              value={settings.defaultAction}
              onChange={(e) => setSettings({ ...settings, defaultAction: e.target.value as FileAction })}
              className="w-full bg-slate-950 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-800 outline-none"
            >
              <option value="MOVE">Move</option>
              <option value="COPY">Copy</option>
              <option value="HARDLINK">Hardlink</option>
              <option value="SYMLINK">Symlink</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Default Language</label>
            <select
              value={settings.defaultLanguage}
              onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value as LanguageCode })}
              className="w-full bg-slate-950 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-800 outline-none"
            >
              <option value="EN">English (EN)</option>
              <option value="DE">German (DE)</option>
              <option value="FR">French (FR)</option>
              <option value="ES">Spanish (ES)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Default Format Presets</h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">TV Format</label>
            <input
              type="text"
              value={settings.tvFormat}
              onChange={(e) => setSettings({ ...settings, tvFormat: e.target.value })}
              className="w-full bg-slate-950 font-mono text-xs text-amber-300 p-2.5 rounded-lg border border-slate-800 outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Movie Format</label>
            <input
              type="text"
              value={settings.movieFormat}
              onChange={(e) => setSettings({ ...settings, movieFormat: e.target.value })}
              className="w-full bg-slate-950 font-mono text-xs text-amber-300 p-2.5 rounded-lg border border-slate-800 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
