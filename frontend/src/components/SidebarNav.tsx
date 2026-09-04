import React from 'react';
import { WorkspaceTab } from '../types';
import { FileText, Tv, Subtitles, CheckSquare, BarChart2, History, Settings } from 'lucide-react';

interface SidebarNavProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenSettings: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ activeTab, onSelectTab, onOpenSettings }) => {
  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'RENAME', label: 'Rename', icon: <FileText className="w-5 h-5" /> },
    { id: 'EPISODES', label: 'Episodes', icon: <Tv className="w-5 h-5" /> },
    { id: 'SUBTITLES', label: 'Subtitles', icon: <Subtitles className="w-5 h-5" /> },
    { id: 'SFV', label: 'SFV', icon: <CheckSquare className="w-5 h-5" /> },
    { id: 'ANALYZE', label: 'Analyze', icon: <BarChart2 className="w-5 h-5" /> },
    { id: 'LIST', label: 'History', icon: <History className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between p-4 border-r border-slate-800">
      <div>
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg">F</div>
          <span className="font-bold text-xl tracking-tight">FileBot</span>
        </div>

        <nav className="space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <button
        onClick={onOpenSettings}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Settings className="w-5 h-5" />
        Settings
      </button>
    </aside>
  );
};
