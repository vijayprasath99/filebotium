import React from 'react';
import { WorkspaceTab } from '../types';
import {
  FolderEdit,
  Globe,
  FileText,
  FileCheck,
  Filter,
  Wand2,
  Settings,
  RotateCcw,
  Terminal,
} from 'lucide-react';

interface SidebarNavProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenSettings: () => void;
  onUndo?: () => void;
  onOpenDevLogs?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  onUndo,
  onOpenDevLogs,
}) => {
  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'LIST', label: 'List', icon: <Wand2 className="w-6 h-6" />, color: 'text-amber-500' },
    { id: 'RENAME', label: 'Rename', icon: <FolderEdit className="w-6 h-6" />, color: 'text-amber-500' },
    { id: 'ANALYZE', label: 'Filter', icon: <Filter className="w-6 h-6" />, color: 'text-slate-600' },
    { id: 'EPISODES', label: 'Episodes', icon: <Globe className="w-6 h-6" />, color: 'text-blue-500' },
    { id: 'SUBTITLES', label: 'Subtitles', icon: <FileText className="w-6 h-6" />, color: 'text-slate-600' },
    { id: 'SFV', label: 'SFV', icon: <FileCheck className="w-6 h-6" />, color: 'text-emerald-600' },
  ];

  return (
    <aside className="w-[82px] bg-white border border-[#c0c0c0] rounded-[6px] m-2 mr-0 flex flex-col justify-between py-1.5 px-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] select-none shrink-0 z-20">
      <div className="flex flex-col items-center w-full space-y-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`w-full flex flex-col items-center justify-center py-2.5 px-0.5 rounded-[3px] text-[11px] font-sans transition-all duration-100 ${
                isActive
                  ? 'bg-[#0070e0] text-white font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-[#333333] hover:bg-[#f0f4f8]'
              }`}
              title={tab.label}
            >
              <div className={`mb-1 ${isActive ? 'text-white' : tab.color}`}>
                {tab.icon}
              </div>
              <span className="leading-tight tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full pt-1 border-t border-[#e8e8e8] flex flex-col items-center gap-1">
        {onUndo && (
          <button
            onClick={onUndo}
            className="w-full flex flex-col items-center justify-center py-1.5 rounded-[3px] text-[10px] font-sans text-[#555555] hover:bg-[#f0f4f8] transition-all"
            title="Undo Last Action"
          >
            <RotateCcw className="w-4 h-4 mb-0.5" />
            <span>Undo</span>
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className={`w-full flex flex-col items-center justify-center py-1.5 rounded-[3px] text-[10px] font-sans transition-all ${
            activeTab === 'SETTINGS'
              ? 'bg-[#0070e0] text-white font-medium'
              : 'text-[#555555] hover:bg-[#f0f4f8]'
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span>Settings</span>
        </button>
        {onOpenDevLogs && (
          <button
            onClick={onOpenDevLogs}
            className="w-full flex flex-col items-center justify-center py-1.5 rounded-[3px] text-[10px] font-sans text-[#555555] hover:bg-[#f0f4f8] hover:text-sky-600 transition-all"
            title="API & WebSocket Dev Logs (Ctrl+Shift+D)"
          >
            <Terminal className="w-4 h-4 mb-0.5" />
            <span>Dev Logs</span>
          </button>
        )}
      </div>
    </aside>
  );
};
