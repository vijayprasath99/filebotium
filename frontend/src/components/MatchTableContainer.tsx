import React, { useState, useRef, useEffect } from 'react';
import { Match, ProviderType, MatchingMode, FileAction } from '../types';
import {
  ArrowUpDown,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  Globe,
  X,
  AlertTriangle,
  Code,
  FolderTree,
} from 'lucide-react';

interface MatchTableContainerProps {
  originalFiles: string[];
  matches: Match[];
  selectedOriginalIdx: number;
  selectedMatchIdx: number;
  onSelectOriginal: (index: number) => void;
  onSelectMatch: (index: number) => void;
  onMatch: () => void;
  onRename: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
  onLoad: () => void;
  onFetchData: () => void;
  onClear: () => void;
  onOpenFormatEditor: () => void;
  isMatching: boolean;
  provider: ProviderType;
  onSelectProvider: (p: ProviderType) => void;
  mode: MatchingMode;
  onSelectMode: (m: MatchingMode) => void;
  action: FileAction;
  onSelectAction: (a: FileAction) => void;
  basePath: string;
  onSetBasePath: (path: string) => void;
}

export const MatchTableContainer: React.FC<MatchTableContainerProps> = ({
  originalFiles,
  matches,
  selectedOriginalIdx,
  selectedMatchIdx,
  onSelectOriginal,
  onSelectMatch,
  onMatch,
  onRename,
  onShiftUp,
  onShiftDown,
  onLoad,
  onFetchData,
  onClear,
  onOpenFormatEditor,
  isMatching,
  provider,
  onSelectProvider,
  mode,
  onSelectMode,
  action,
  onSelectAction,
  basePath,
  onSetBasePath,
}) => {
  const [showBasePathInput, setShowBasePathInput] = useState(false);
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    const saved = localStorage.getItem('filebot_rename_split_percent');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) {
        return parsed;
      }
    }
    return 50;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isResizing) return;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(20, Math.min(80, newPercent));
      setSplitPercent(clamped);
      localStorage.setItem('filebot_rename_split_percent', clamped.toFixed(1));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResetSplit = () => {
    setSplitPercent(50);
    localStorage.setItem('filebot_rename_split_percent', '50');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none p-1 font-sans gap-1.5">
      {/* Top Configuration Bar */}
      <div className="flex items-center justify-between px-1 py-1 bg-white/70 border border-[#c0c0c0] rounded-[4px] text-[11px] shrink-0">
        <div className="flex items-center gap-2">
          {/* Mode Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[#666666] font-medium">Mode:</span>
            <select
              value={mode}
              onChange={(e) => onSelectMode(e.target.value as MatchingMode)}
              className="bg-white border border-[#adadad] rounded px-1.5 py-0.5 text-[#222222] outline-none cursor-pointer"
            >
              <option value="TV">TV Shows</option>
              <option value="MOVIE">Movies</option>
              <option value="ANIME">Anime</option>
            </select>
          </div>

          {/* Provider Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[#666666] font-medium">Provider:</span>
            <select
              value={provider}
              onChange={(e) => onSelectProvider(e.target.value as ProviderType)}
              className="bg-white border border-[#adadad] rounded px-1.5 py-0.5 text-[#222222] outline-none cursor-pointer"
            >
              <option value="THE_TVDB">TheTVDB</option>
              <option value="THE_MOVIE_DB">TheMovieDB</option>
              <option value="ANI_DB">AniDB</option>
              <option value="TV_MAZE">TVmaze</option>
            </select>
          </div>

          {/* Action Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[#666666] font-medium">Action:</span>
            <select
              value={action}
              onChange={(e) => onSelectAction(e.target.value as FileAction)}
              className="bg-white border border-[#adadad] rounded px-1.5 py-0.5 text-[#222222] outline-none cursor-pointer"
            >
              <option value="MOVE">Move</option>
              <option value="COPY">Copy</option>
              <option value="HARDLINK">Hardlink</option>
              <option value="SYMLINK">Symlink</option>
            </select>
          </div>
        </div>

        {/* Base Folder Override (for browser fake path resolution) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowBasePathInput(!showBasePathInput)}
            className={`flex items-center gap-1 px-2 py-0.5 border rounded-[3px] text-[10px] font-medium transition-colors ${
              basePath
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                : 'bg-white border-[#b0b0b0] text-[#555555] hover:bg-slate-50'
            }`}
            title="Set disk base folder if browser uploads fake paths"
          >
            <FolderTree className="w-3 h-3" />
            <span>{basePath ? `Base: ${basePath}` : 'Base Folder Override'}</span>
          </button>
          {showBasePathInput && (
            <input
              type="text"
              value={basePath}
              onChange={(e) => onSetBasePath(e.target.value)}
              placeholder="e.g. D:/Media/TV"
              className="px-2 py-0.5 border border-blue-400 rounded bg-white text-[11px] outline-none w-44 font-mono text-[#111111]"
            />
          )}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 flex min-h-0 relative select-none">
        {/* Left Column: Original Files (Drag & Drop Zone) */}
        <div
          style={{ width: `calc(${splitPercent}% - 46px)`, minWidth: '150px' }}
          className="flex flex-col min-h-0 shrink-0"
        >
          <div className="pb-1 px-1 flex items-center justify-between">
            <span className="text-[12px] font-normal text-[#555555]">Original Files</span>
            <span className="text-[10px] text-slate-400 font-mono">({originalFiles.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto bg-white border border-[#a8a8a8] rounded-[2px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] flex flex-col">
            {originalFiles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                <div className="text-slate-400 text-xs font-sans">Drag &amp; drop files here</div>
                <div className="text-[10px] text-slate-400 mt-1">or click &quot;Load&quot; in the bottom toolbar</div>
              </div>
            ) : (
              <div>
                {originalFiles.map((file, idx) => {
                  const isSelected = selectedOriginalIdx === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectOriginal(idx)}
                      className={`px-2 py-0.5 text-[12px] font-mono cursor-pointer truncate ${
                        isSelected
                          ? 'bg-[#0070e0] text-white font-medium'
                          : 'text-[#111111] hover:bg-[#eaf2fc]'
                      }`}
                    >
                      {file}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Resizable Splitter Divider (Left side of buttons) */}
        <div
          onMouseDown={handleStartResize}
          onDoubleClick={handleResetSplit}
          className="w-2 mx-0.5 flex items-center justify-center cursor-col-resize group shrink-0 select-none z-10"
          title="Drag to resize drop zone (double-click to reset 50/50)"
        >
          <div
            className={`w-0.5 h-12 rounded-full transition-colors ${
              isResizing ? 'bg-[#0070e0]' : 'bg-[#c8c8c8] group-hover:bg-[#0070e0]'
            }`}
          />
        </div>

        {/* Center Column: Match & Rename Action Buttons */}
        <div className="flex flex-col items-center justify-center gap-3 px-1 shrink-0">
          {/* Match Button */}
          <button
            onClick={onMatch}
            disabled={isMatching || originalFiles.length === 0}
            className="w-[72px] h-[58px] bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-[#fdfdfd] hover:to-[#dadada] active:from-[#d8d8d8] active:to-[#cdcdcd] border border-[#a6a6a6] rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-40 transition-all"
            title="Automatically align episode data with your files"
          >
            <div className="flex items-center text-[#16a34a]">
              <ArrowUpDown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-medium text-[#222222]">Match</span>
          </button>

          {/* Rename Button */}
          <button
            onClick={onRename}
            disabled={matches.length === 0}
            className="w-[72px] h-[58px] bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-[#fdfdfd] hover:to-[#dadada] active:from-[#d8d8d8] active:to-[#cdcdcd] border border-[#a6a6a6] rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-40 transition-all"
            title="Rename files"
          >
            <div className="flex items-center text-[#0070e0]">
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-medium text-[#222222]">Rename</span>
          </button>
        </div>

        {/* Resizable Splitter Divider (Right side of buttons) */}
        <div
          onMouseDown={handleStartResize}
          onDoubleClick={handleResetSplit}
          className="w-2 mx-0.5 flex items-center justify-center cursor-col-resize group shrink-0 select-none z-10"
          title="Drag to resize drop zone (double-click to reset 50/50)"
        >
          <div
            className={`w-0.5 h-12 rounded-full transition-colors ${
              isResizing ? 'bg-[#0070e0]' : 'bg-[#c8c8c8] group-hover:bg-[#0070e0]'
            }`}
          />
        </div>

        {/* Right Column: New Names */}
        <div className="flex-1 flex flex-col min-h-0 min-w-[180px]">
          <div className="pb-1 px-1">
            <span className="text-[12px] font-normal text-[#555555]">New Names</span>
          </div>

        <div className="flex-1 overflow-y-auto bg-white border border-[#a8a8a8] rounded-[2px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)]">
          {matches.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs font-sans">
              No matches loaded
            </div>
          ) : (
            <div>
              {matches.map((m, idx) => {
                const isSelected = selectedMatchIdx === idx;
                const isWarningRow = m.score < 0.8 || m.status === 'CONFLICT';

                let rowBg = idx % 2 === 1 ? 'bg-[#f7f9fc] text-[#111111]' : 'bg-white text-[#111111]';
                if (isSelected) {
                  rowBg = 'bg-[#0070e0] text-white font-medium';
                } else if (isWarningRow) {
                  rowBg = 'bg-[#fee2e2] text-[#991b1b] font-medium';
                }

                return (
                  <div
                    key={m.matchId || idx}
                    onClick={() => onSelectMatch(idx)}
                    className={`px-2 py-0.5 text-[12px] font-mono cursor-pointer flex items-center gap-1.5 truncate ${rowBg}`}
                  >
                    {isWarningRow && (
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-300 shrink-0 fill-yellow-300 text-red-600" />
                    )}
                    <span className="truncate">{m.formattedName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Toolbar directly under New Names */}
        <div className="pt-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              onClick={onShiftDown}
              disabled={selectedMatchIdx === -1 || selectedMatchIdx >= matches.length - 1}
              className="w-6 h-6 bg-gradient-to-b from-white to-[#e6e6e6] hover:from-[#fafafa] hover:to-[#dadada] active:from-[#d0d0d0] active:to-[#c0c0c0] border border-[#a0a0a0] rounded-[3px] shadow-sm flex items-center justify-center text-[#e67e22] disabled:opacity-40"
              title="Shift Row Down"
            >
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <button
              onClick={onShiftUp}
              disabled={selectedMatchIdx <= 0}
              className="w-6 h-6 bg-gradient-to-b from-white to-[#e6e6e6] hover:from-[#fafafa] hover:to-[#dadada] active:from-[#d0d0d0] active:to-[#c0c0c0] border border-[#a0a0a0] rounded-[3px] shadow-sm flex items-center justify-center text-[#e67e22] disabled:opacity-40"
              title="Shift Row Up"
            >
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onLoad}
              className="px-2.5 py-0.5 bg-gradient-to-b from-white to-[#e6e6e6] hover:from-[#fafafa] hover:to-[#dadada] active:from-[#d0d0d0] active:to-[#c0c0c0] border border-[#a0a0a0] rounded-[3px] shadow-sm text-[11px] font-medium text-[#222222] flex items-center gap-1"
              title="Load"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              <span>Load</span>
            </button>
            <button
              onClick={onFetchData}
              className="px-2.5 py-0.5 bg-gradient-to-b from-white to-[#e6e6e6] hover:from-[#fafafa] hover:to-[#dadada] active:from-[#d0d0d0] active:to-[#c0c0c0] border border-[#a0a0a0] rounded-[3px] shadow-sm text-[11px] font-medium text-[#222222] flex items-center gap-1"
              title="Fetch Data"
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>Fetch Data</span>
            </button>
            <button
              onClick={onOpenFormatEditor}
              className="px-2 py-0.5 bg-gradient-to-b from-white to-[#e6e6e6] hover:from-[#fafafa] hover:to-[#dadada] border border-[#a0a0a0] rounded-[3px] shadow-sm text-[11px] font-medium text-[#555555] flex items-center gap-1"
              title="Format"
            >
              <Code className="w-3 h-3 text-emerald-600" />
            </button>
            <button
              onClick={onClear}
              className="w-6 h-6 bg-gradient-to-b from-white to-[#e6e6e6] hover:from-[#fafafa] hover:to-[#dadada] active:from-[#d0d0d0] active:to-[#c0c0c0] border border-[#a0a0a0] rounded-[3px] shadow-sm flex items-center justify-center text-red-600"
              title="Close / Clear"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
