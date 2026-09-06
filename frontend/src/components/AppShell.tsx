import React, { useEffect, useState, useCallback } from 'react';
import { WorkspaceTab, SystemStatus } from '../types';
import { SidebarNav } from './SidebarNav';
import { HeaderBar } from './HeaderBar';
import { GlobalDropZone } from './GlobalDropZone';
import { RenameWorkspace } from './RenameWorkspace';
import { EpisodesExplorerPanel } from './EpisodesExplorerPanel';
import { SubtitlePanel } from './SubtitlePanel';
import { SfvPanel } from './SfvPanel';
import { AnalyzePanel } from './AnalyzePanel';
import { HistoryPanel } from './HistoryPanel';
import { SettingsPanel } from './SettingsPanel';
import { FormatEditorModal } from './FormatEditorModal';
import { appApi } from '../api/client';

const TAB_ORDER: WorkspaceTab[] = [
  'LIST',
  'RENAME',
  'ANALYZE',
  'EPISODES',
  'SUBTITLES',
  'SFV',
];

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('RENAME');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [droppedFiles, setDroppedFiles] = useState<string[]>([]);
  const [formatExpression, setFormatExpression] = useState(
    '{ drive }/media/tv/{ ~plex.year.id }'
  );
  const [isFormatEditorOpen, setIsFormatEditorOpen] = useState(false);

  useEffect(() => {
    appApi
      .getStatus()
      .then(setSystemStatus)
      .catch(() => {
        setSystemStatus({
          appName: 'FileBot',
          version: '1.0.0',
          javaVersion: '21.0.2',
          osName: 'Windows 11',
          osArch: 'amd64',
          freeMemoryBytes: 69531280,
          totalMemoryBytes: 111149056,
        });
      });
  }, []);

  // Keyboard shortcut navigation (Ctrl/Cmd + 1..6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
        const index = parseInt(e.key, 10) - 1;
        if (TAB_ORDER[index]) {
          e.preventDefault();
          setActiveTab(TAB_ORDER[index]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFilesDropped = useCallback((paths: string[]) => {
    setDroppedFiles((prev) => [...prev, ...paths]);
  }, []);

  const handleNavigateTab = (tab: WorkspaceTab, files?: string[]) => {
    setActiveTab(tab);
    if (files && files.length > 0) {
      setDroppedFiles(files);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#ebebeb] text-[#222222] font-sans overflow-hidden select-none">
      <HeaderBar
        activeTab={activeTab}
        systemStatus={systemStatus}
        onUndo={() => alert('Global Undo triggered')}
      />

      <div className="flex-1 flex overflow-hidden">
        <SidebarNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenSettings={() => setActiveTab('SETTINGS')}
        />

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <GlobalDropZone onFilesDropped={handleFilesDropped}>
            {activeTab === 'RENAME' && (
              <RenameWorkspace
                files={droppedFiles}
                formatExpression={formatExpression}
                onOpenFormatEditor={() => setIsFormatEditorOpen(true)}
              />
            )}
            {activeTab === 'EPISODES' && <EpisodesExplorerPanel />}
            {activeTab === 'SUBTITLES' && <SubtitlePanel />}
            {activeTab === 'SFV' && <SfvPanel />}
            {activeTab === 'ANALYZE' && (
              <AnalyzePanel onNavigateTab={handleNavigateTab} />
            )}
            {activeTab === 'LIST' && <HistoryPanel />}
            {activeTab === 'SETTINGS' && <SettingsPanel />}
          </GlobalDropZone>
        </div>
      </div>

      <FormatEditorModal
        isOpen={isFormatEditorOpen}
        initialExpression={formatExpression}
        onSave={setFormatExpression}
        onClose={() => setIsFormatEditorOpen(false)}
      />
    </div>
  );
};

export default AppShell;
