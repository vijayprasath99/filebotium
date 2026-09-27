import React, { useState, useEffect } from 'react';
import { Match, ProviderType, MatchingMode, FileAction } from '../types';
import { MatchTableContainer } from './MatchTableContainer';
import { PresetManagerModal } from './PresetManagerModal';
import { renameApi, appApi, Preset, presetApi } from '../api/client';
import { getFilePaths } from '../utils/fileUtils';

interface RenameWorkspaceProps {
  files: string[];
  onOpenFormatEditor: () => void;
  formatExpression: string;
}

export const RenameWorkspace: React.FC<RenameWorkspaceProps> = ({
  files,
  onOpenFormatEditor,
  formatExpression,
}) => {
  const [originalFiles, setOriginalFiles] = useState<string[]>(files);
  const [matches, setMatches] = useState<Match[]>([]);
  const [provider, setProvider] = useState<ProviderType>('THE_TVDB');
  const [mode, setMode] = useState<MatchingMode>('TV');
  const [action, setAction] = useState<FileAction>('MOVE');
  const [basePath, setBasePath] = useState<string>('');
  const [selectedOriginalIdx, setSelectedOriginalIdx] = useState(-1);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(-1);
  const [isMatching, setIsMatching] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind: 'info' | 'success' | 'error' } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [presetFormatOverride, setPresetFormatOverride] = useState<string | null>(null);
  const [quickPresets, setQuickPresets] = useState<Preset[]>([]);

  const effectiveFormatExpression = presetFormatOverride ?? formatExpression;

  // A fresh format expression from Settings/FormatEditor takes precedence over any preset
  // override still in effect from a previous selection.
  useEffect(() => {
    setPresetFormatOverride(null);
  }, [formatExpression]);

  const applyPreset = (preset: Preset) => {
    if (preset.formatExpression) setPresetFormatOverride(preset.formatExpression);
    if (preset.provider) setProvider(preset.provider);
    if (preset.mode) setMode(preset.mode);
    if (preset.action) setAction(preset.action);
    showStatus(`Applied preset "${preset.name}".`, 'info');
  };

  // Load the first 9 presets once so 1-9 keyboard shortcuts can apply them instantly,
  // mirroring legacy RenamePanel.installKeyStrokeActions (specs/audit/02_03_rename_format_audit.md RF-11).
  useEffect(() => {
    presetApi
      .listPresets()
      .then((presets) => setQuickPresets(presets.slice(0, 9)))
      .catch(() => setQuickPresets([]));
  }, [isPresetManagerOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        const preset = quickPresets[parseInt(e.key, 10) - 1];
        if (preset) {
          e.preventDefault();
          applyPreset(preset);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickPresets]);

  const showStatus = (text: string, kind: 'info' | 'success' | 'error' = 'info') => {
    setStatusMsg({ text, kind });
    setTimeout(() => setStatusMsg(null), 6000);
  };

  useEffect(() => {
    if (files.length > 0) {
      setOriginalFiles(files);
    }
  }, [files]);

  // Re-apply format when the effective format expression changes
  useEffect(() => {
    if (matches.length > 0) {
      renameApi
        .applyFormat(matches, effectiveFormatExpression)
        .then((updated) => {
          if (updated && updated.length > 0) {
            setMatches(updated);
          }
        })
        .catch(console.error);
    }
  }, [effectiveFormatExpression]);

  const resolvePaths = (paths: string[]): string[] => {
    if (!basePath.trim()) return paths;
    const cleanBase = basePath.trim().replace(/[/\\]+$/, '');
    return paths.map((p) => {
      // Remove fakepath if present
      const cleanName = p.replace(/^C:[/\\]fakepath[/\\]/i, '');
      if (cleanName.includes('/') || cleanName.includes('\\')) {
        return cleanName;
      }
      return `${cleanBase}/${cleanName}`;
    });
  };

  const handleMatch = async () => {
    if (originalFiles.length === 0) return;
    setIsMatching(true);
    try {
      const resolved = resolvePaths(originalFiles);
      const result = await renameApi.autoMatch(
        resolved,
        provider,
        mode,
        'EN',
        effectiveFormatExpression
      );
      if (result && result.length > 0) {
        setMatches(result);
      }
    } catch (err) {
      console.error('Failed to match files:', err);
      showStatus('Failed to match files. Ensure the backend server is reachable.', 'error');
    } finally {
      setIsMatching(false);
    }
  };

  const handleRename = async () => {
    if (matches.length === 0) return;
    try {
      const res = await renameApi.executeRename(matches, action, 'OVERWRITE');
      if (res.failureCount > 0) {
        const errorSummary = res.errors.map((e) => `${e.sourcePath}: ${e.errorMessage}`).join(' | ');
        showStatus(
          `Rename completed with errors — success: ${res.successCount}, failures: ${res.failureCount}. ${errorSummary}`,
          'error'
        );
      } else {
        showStatus(`Successfully renamed ${res.successCount} file(s)!`, 'success');
      }
      handleClear();
    } catch (err: any) {
      showStatus(`Rename execution failed: ${err?.message || err}`, 'error');
    }
  };

  const handleShiftUp = async () => {
    if (selectedMatchIdx <= 0) return;
    try {
      const targetIdx = selectedMatchIdx - 1;
      const reordered = await renameApi.updateRowAlignment(matches, selectedMatchIdx, targetIdx);
      setMatches(reordered);
      setSelectedMatchIdx(targetIdx);
    } catch {
      // Fallback local shift
      const copy = [...matches];
      const item = copy.splice(selectedMatchIdx, 1)[0];
      copy.splice(selectedMatchIdx - 1, 0, item);
      setMatches(copy);
      setSelectedMatchIdx(selectedMatchIdx - 1);
    }
  };

  const handleShiftDown = async () => {
    if (selectedMatchIdx === -1 || selectedMatchIdx >= matches.length - 1) return;
    try {
      const targetIdx = selectedMatchIdx + 1;
      const reordered = await renameApi.updateRowAlignment(matches, selectedMatchIdx, targetIdx);
      setMatches(reordered);
      setSelectedMatchIdx(targetIdx);
    } catch {
      // Fallback local shift
      const copy = [...matches];
      const item = copy.splice(selectedMatchIdx, 1)[0];
      copy.splice(selectedMatchIdx + 1, 0, item);
      setMatches(copy);
      setSelectedMatchIdx(selectedMatchIdx + 1);
    }
  };

  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const rawPaths = getFilePaths(e.target.files);
      try {
        const ingested = await appApi.intakeFiles(rawPaths, 'RENAME');
        if (ingested?.acceptedFiles?.length > 0) {
          setOriginalFiles((prev) => [...prev, ...ingested.acceptedFiles.map((f) => f.path)]);
        } else {
          setOriginalFiles((prev) => [...prev, ...rawPaths]);
        }
      } catch {
        setOriginalFiles((prev) => [...prev, ...rawPaths]);
      }
    }
    if (e.target) e.target.value = '';
  };

  const handleFetchData = () => {
    handleMatch();
  };

  const handleClear = () => {
    setOriginalFiles([]);
    setMatches([]);
    setSelectedOriginalIdx(-1);
    setSelectedMatchIdx(-1);
  };

  const handleToggleExclude = (idx: number) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, isExcluded: !m.isExcluded } : m))
    );
  };

  const handleManualRename = (idx: number, newFormattedName: string) => {
    setMatches((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        const sep = m.formattedPath.includes('\\') ? '\\' : '/';
        const dir = m.formattedPath.slice(0, m.formattedPath.lastIndexOf(sep) + 1);
        return {
          ...m,
          formattedName: newFormattedName,
          formattedPath: dir ? `${dir}${newFormattedName}` : newFormattedName,
          status: 'MANUAL',
        };
      })
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#ebebeb] p-2 overflow-hidden select-none">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFilesSelected}
        className="hidden"
      />
      {statusMsg && (
        <div
          className={`mb-2 px-3 py-1.5 rounded text-xs font-sans shrink-0 ${
            statusMsg.kind === 'error'
              ? 'bg-red-100 border border-red-300 text-red-700'
              : statusMsg.kind === 'success'
              ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          {statusMsg.text}
        </div>
      )}
      <MatchTableContainer
        originalFiles={originalFiles}
        matches={matches}
        selectedOriginalIdx={selectedOriginalIdx}
        selectedMatchIdx={selectedMatchIdx}
        onSelectOriginal={setSelectedOriginalIdx}
        onSelectMatch={setSelectedMatchIdx}
        onMatch={handleMatch}
        onRename={handleRename}
        onShiftUp={handleShiftUp}
        onShiftDown={handleShiftDown}
        onLoad={handleLoad}
        onFetchData={handleFetchData}
        onClear={handleClear}
        onOpenFormatEditor={onOpenFormatEditor}
        onOpenPresetManager={() => setIsPresetManagerOpen(true)}
        onToggleExclude={handleToggleExclude}
        onManualRename={handleManualRename}
        isMatching={isMatching}
        provider={provider}
        onSelectProvider={setProvider}
        mode={mode}
        onSelectMode={setMode}
        action={action}
        onSelectAction={setAction}
        basePath={basePath}
        onSetBasePath={setBasePath}
      />

      <PresetManagerModal
        isOpen={isPresetManagerOpen}
        onClose={() => setIsPresetManagerOpen(false)}
        currentConfig={{
          formatExpression: effectiveFormatExpression,
          provider,
          mode,
          language: 'EN',
          action,
        }}
        onApplyPreset={applyPreset}
      />
    </div>
  );
};
