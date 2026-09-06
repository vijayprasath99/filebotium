import React from 'react';
import { WorkspaceTab, SystemStatus } from '../types';
import { RotateCcw } from 'lucide-react';

interface HeaderBarProps {
  activeTab: WorkspaceTab;
  systemStatus: SystemStatus | null;
  onUndo: () => void;
}

const TAB_TITLES: Record<WorkspaceTab, string> = {
  RENAME: 'Rename',
  EPISODES: 'Episodes',
  SUBTITLES: 'Download Subtitles',
  ANALYZE: 'Filter',
  SFV: 'SFV Checksum',
  LIST: 'List',
  SETTINGS: 'Preferences',
};

export const HeaderBar: React.FC<HeaderBarProps> = ({ activeTab, onUndo }) => {
  return (
    <header className="h-9 bg-gradient-to-b from-[#fbfbfb] to-[#ececec] border-b border-[#c8c8c8] px-3.5 flex items-center justify-between select-none shrink-0 relative shadow-[0_1px_0_rgba(255,255,255,0.8)]">
      {/* macOS Window Controls */}
      <div className="flex items-center gap-2 z-10">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] cursor-pointer" />
        </div>
        <span className="text-[11px] font-semibold text-[#555555] ml-2 tracking-tight">FileBot</span>
      </div>

      {/* Centered Window Title */}
      <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
        <h1 className="text-[14px] font-normal text-[#222222] tracking-normal font-sans">
          {TAB_TITLES[activeTab]}
        </h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 z-10">
        <button
          onClick={onUndo}
          title="Undo"
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-gradient-to-b from-white to-[#ececec] hover:from-[#f5f5f5] hover:to-[#e0e0e0] active:from-[#e0e0e0] active:to-[#d0d0d0] text-[#333333] rounded-[4px] border border-[#adadad] shadow-sm transition-all"
        >
          <RotateCcw className="w-3 h-3 text-[#555555]" />
          <span>Undo</span>
        </button>
      </div>
    </header>
  );
};
