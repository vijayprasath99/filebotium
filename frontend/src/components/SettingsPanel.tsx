import React, { useEffect, useState } from 'react';
import { AppSettings, FileAction, LanguageCode, ProviderType } from '../types';
import { settingsApi } from '../api/client';
import { Settings, Save, RotateCcw, Key, AlertCircle, CheckCircle2 } from 'lucide-react';

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

  const [providerCreds, setProviderCreds] = useState<{
    provider: ProviderType;
    apiKey: string;
    username: string;
    password: string;
  }>({
    provider: 'THE_TVDB',
    apiKey: '',
    username: '',
    password: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    settingsApi
      .getSettings()
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => {
        console.error('Error loading settings', err);
        setStatusMessage({ text: 'Failed to load settings from server. Showing defaults.', isError: true });
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await settingsApi.updateSettings(settings);
      setSettings(updated);
      setStatusMessage({ text: 'Application settings saved successfully!' });
    } catch (err) {
      setStatusMessage({ text: 'Error saving settings.', isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all settings to application factory defaults?')) return;
    try {
      await settingsApi.resetToDefaults();
      const fresh = await settingsApi.getSettings();
      setSettings(fresh);
      setStatusMessage({ text: 'Settings have been reset to factory defaults.' });
    } catch (err) {
      setStatusMessage({ text: 'Error resetting settings to defaults.', isError: true });
    }
  };

  const handleSaveCredentials = async () => {
    setIsSavingCreds(true);
    try {
      await settingsApi.saveCredentials({
        provider: providerCreds.provider,
        apiKey: providerCreds.apiKey,
        username: providerCreds.username,
        password: providerCreds.password,
      });
      setStatusMessage({
        text: `Credentials for ${providerCreds.provider.replace('_', ' ')} saved successfully.`,
      });
      setProviderCreds((prev) => ({ ...prev, password: '', apiKey: '' }));
    } catch (err) {
      setStatusMessage({ text: 'Failed to save provider credentials.', isError: true });
    } finally {
      setIsSavingCreds(false);
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 bg-slate-950 text-slate-100 overflow-auto">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-200">Application Settings & Preferences</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            Reset to Defaults
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`text-xs px-4 py-2.5 rounded-lg border flex items-center justify-between ${
            statusMessage.isError
              ? 'bg-red-950/40 border-red-800/60 text-red-300'
              : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.isError ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-200 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Defaults */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">General Defaults</h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Default File Action</label>
            <select
              value={settings.defaultAction}
              onChange={(e) => setSettings({ ...settings, defaultAction: e.target.value as FileAction })}
              className="w-full bg-slate-950 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-blue-500"
            >
              <option value="MOVE">Move (Default)</option>
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
              className="w-full bg-slate-950 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-blue-500"
            >
              <option value="EN">English (EN)</option>
              <option value="DE">German (DE)</option>
              <option value="FR">French (FR)</option>
              <option value="ES">Spanish (ES)</option>
              <option value="JA">Japanese (JA)</option>
              <option value="ZH">Chinese (ZH)</option>
            </select>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={settings.filterHiddenFiles ?? true}
                onChange={(e) => setSettings({ ...settings, filterHiddenFiles: e.target.checked })}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 w-4 h-4"
              />
              <span>Filter hidden files and system artifacts (.DS_Store, Thumbs.db)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={settings.recursiveSearch ?? true}
                onChange={(e) => setSettings({ ...settings, recursiveSearch: e.target.checked })}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 w-4 h-4"
              />
              <span>Recursively inspect directories upon drag-and-drop</span>
            </label>
          </div>
        </div>

        {/* Format Presets */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Default Format Presets</h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">TV Series Format</label>
            <input
              type="text"
              value={settings.tvFormat}
              onChange={(e) => setSettings({ ...settings, tvFormat: e.target.value })}
              className="w-full bg-slate-950 font-mono text-xs text-amber-300 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Movie Format</label>
            <input
              type="text"
              value={settings.movieFormat}
              onChange={(e) => setSettings({ ...settings, movieFormat: e.target.value })}
              className="w-full bg-slate-950 font-mono text-xs text-amber-300 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Anime Format</label>
            <input
              type="text"
              value={settings.animeFormat || '{n} - {absolute} - {t}'}
              onChange={(e) => setSettings({ ...settings, animeFormat: e.target.value })}
              className="w-full bg-slate-950 font-mono text-xs text-amber-300 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Music Format</label>
            <input
              type="text"
              value={settings.musicFormat || '{artist} - {album}/{pi} - {t}'}
              onChange={(e) => setSettings({ ...settings, musicFormat: e.target.value })}
              className="w-full bg-slate-950 font-mono text-xs text-amber-300 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Provider API Credentials */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Online Database API Credentials
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Configure custom API keys and accounts for media providers (TheTVDB, TheMovieDB, OpenSubtitles).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Provider</label>
              <select
                value={providerCreds.provider}
                onChange={(e) =>
                  setProviderCreds({ ...providerCreds, provider: e.target.value as ProviderType })
                }
                className="w-full bg-slate-950 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="THE_TVDB">TheTVDB</option>
                <option value="THE_MOVIE_DB">TheMovieDB</option>
                <option value="OPEN_SUBTITLES">OpenSubtitles</option>
                <option value="ANI_DB">AniDB</option>
                <option value="TVMAZE">TVmaze</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">API Key / Token</label>
              <input
                type="password"
                placeholder="Paste API key..."
                value={providerCreds.apiKey}
                onChange={(e) => setProviderCreds({ ...providerCreds, apiKey: e.target.value })}
                className="w-full bg-slate-950 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Username (Optional)</label>
              <input
                type="text"
                placeholder="Account username..."
                value={providerCreds.username}
                onChange={(e) => setProviderCreds({ ...providerCreds, username: e.target.value })}
                className="w-full bg-slate-950 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Password (Optional)</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Password..."
                  value={providerCreds.password}
                  onChange={(e) => setProviderCreds({ ...providerCreds, password: e.target.value })}
                  className="flex-1 bg-slate-950 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={handleSaveCredentials}
                  disabled={isSavingCreds || (!providerCreds.apiKey && !providerCreds.username)}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  {isSavingCreds ? 'Saving...' : 'Save Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
