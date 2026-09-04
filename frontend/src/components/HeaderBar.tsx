import React from 'react';
import { WorkspaceTab, SystemStatus } from '../types';
import { RotateCcw, Cpu } from 'lucide-react';

interface HeaderBarProps {
  activeTab: WorkspaceTab;
  systemStatus: SystemStatus | null;
  onUndo: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ activeTab, systemStatus, onUndo }) => {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-slate-100">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-100">{activeTab} Workspace</h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onUndo}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Undo
        </button>

        {systemStatus && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Java {systemStatus.javaVersion}</span>
            <span className="text-slate-600">|</span>
            <span>{systemStatus.osName}</span>
          </div>
        )}
      </div>
    </header>
  );
};
