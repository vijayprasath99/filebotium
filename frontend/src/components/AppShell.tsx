import React, { useEffect, useState } from 'react';
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

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('RENAME');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [droppedFiles, setDroppedFiles] = useState<string[]>([]);
  const [formatExpression, setFormatExpression] = useState('{n} - {s00e00} - {t}');
  const [isFormatEditorOpen, setIsFormatEditorOpen] = useState(false);

  useEffect(() => {
    appApi.getStatus().then(setSystemStatus).catch(console.error);
  }, []);

  const handleFilesDropped = (paths: string[]) => {
    setDroppedFiles((prev) => [...prev, ...paths]);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setActiveTab('SETTINGS')}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <HeaderBar
          activeTab={activeTab}
          systemStatus={systemStatus}
          onUndo={() => alert('Global Undo triggered')}
        />

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
          {activeTab === 'ANALYZE' && <AnalyzePanel />}
          {activeTab === 'LIST' && <HistoryPanel />}
          {activeTab === 'SETTINGS' && <SettingsPanel />}
        </GlobalDropZone>
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
