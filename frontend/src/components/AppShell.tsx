import React, { useEffect, useState, useCallback } from 'react';
import { WorkspaceTab, SystemStatus } from '../types';
import { SidebarNav } from './SidebarNav';
import { GlobalDropZone } from './GlobalDropZone';
import { RenameWorkspace } from './RenameWorkspace';
import { EpisodesExplorerPanel } from './EpisodesExplorerPanel';
import { SubtitlePanel } from './SubtitlePanel';
import { SfvPanel } from './SfvPanel';
import { AnalyzePanel } from './AnalyzePanel';
import { HistoryPanel } from './HistoryPanel';
import { ListPanelPlaceholder } from './ListPanelPlaceholder';
import { SettingsPanel } from './SettingsPanel';
import { FormatEditorModal } from './FormatEditorModal';
import { DevLogsModal } from './DevLogsModal';
import { websocketClient } from '../api/websocketClient';
import { appApi, historyApi, settingsApi } from '../api/client';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const TAB_ORDER: WorkspaceTab[] = [
  'RENAME',
  'ANALYZE',
  'EPISODES',
  'SUBTITLES',
  'SFV',
  'LIST',
  'HISTORY',
];

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('RENAME');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [droppedFiles, setDroppedFiles] = useState<string[]>([]);
  const [formatExpression, setFormatExpression] = useState('{n} - {s00e00} - {t}');
  const [isFormatEditorOpen, setIsFormatEditorOpen] = useState(false);
  const [isDevLogsOpen, setIsDevLogsOpen] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    appApi
      .getStatus()
      .then(setSystemStatus)
      .catch(() => {
        setSystemStatus(null);
      });

    // Load the user's saved format preset (specs/audit/09_settings_audit.md SET-13 - this call
    // never happened before, so Settings' "Default Format Presets" tab had no effect on Rename).
    settingsApi
      .getSettings()
      .then((settings) => {
        if (settings?.tvFormat) {
          setFormatExpression(settings.tvFormat);
        }
      })
      .catch(() => {
        // Keep the built-in default if settings can't be loaded.
      });

    // Auto-connect STOMP WebSocket client for live progress and debugging
    websocketClient.connect();

    const unsubscribeNotifications = websocketClient.subscribe(
      '/topic/notifications',
      (payload: { level?: string; message?: string }) => {
        if (!payload?.message) return;
        setNotification({
          text: payload.message,
          isError: payload.level === 'ERROR' || payload.level === 'WARNING',
        });
      }
    );

    return () => {
      unsubscribeNotifications();
      websocketClient.disconnect();
    };
  }, []);

  // Keyboard shortcut navigation (Ctrl/Cmd + 1..7) and Dev Logs (Ctrl/Cmd + Shift + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsDevLogsOpen((prev) => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '7') {
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

  const handleFilesDropped = useCallback(
    (paths: string[]) => {
      appApi
        .intakeFiles(paths, activeTab)
        .then((res) => {
          const accepted = res.acceptedFiles.map((f) => f.path);
          setDroppedFiles((prev) => [...prev, ...accepted]);
        })
        .catch((err) => {
          console.warn('Failed to register dropped files with backend:', err);
          setDroppedFiles((prev) => [...prev, ...paths]);
        });
    },
    [activeTab]
  );

  const handleNavigateTab = (tab: WorkspaceTab, files?: string[]) => {
    setActiveTab(tab);
    if (files && files.length > 0) {
      setDroppedFiles(files);
    }
  };

  const handleGlobalUndo = async () => {
    try {
      const historyList = await historyApi.getHistory();
      if (!historyList || historyList.length === 0) {
        setNotification({ text: 'No recent rename transactions to undo.', isError: false });
        return;
      }
      const latest = historyList[0];
      const result = await historyApi.rollbackTransaction(latest.transactionId);
      if (result.failureCount > 0) {
        setNotification({
          text: `Undo completed with warning: ${result.failureCount} file(s) could not be restored.`,
          isError: true,
        });
      } else {
        setNotification({
          text: `Undo successful: Restored ${result.successCount} file(s).`,
          isError: false,
        });
      }
    } catch (err) {
      console.error('Failed to execute global undo', err);
      setNotification({ text: 'Global Undo request failed on backend.', isError: true });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#ebebeb] text-[#222222] font-sans overflow-hidden select-none">
      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between px-6 py-2 text-xs border-b transition-all ${
            notification.isError
              ? 'bg-red-950 text-red-200 border-red-800'
              : 'bg-emerald-950 text-emerald-200 border-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.isError ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span className="font-medium">{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white text-xs underline font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <SidebarNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenSettings={() => setActiveTab('SETTINGS')}
          onUndo={handleGlobalUndo}
          onOpenDevLogs={() => setIsDevLogsOpen(true)}
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
            {activeTab === 'EPISODES' && (
              <EpisodesExplorerPanel files={droppedFiles} onNavigateTab={handleNavigateTab} />
            )}
            {activeTab === 'SUBTITLES' && <SubtitlePanel files={droppedFiles} />}
            {activeTab === 'SFV' && <SfvPanel files={droppedFiles} />}
            {activeTab === 'ANALYZE' && (
              <AnalyzePanel files={droppedFiles} onNavigateTab={handleNavigateTab} />
            )}
            {activeTab === 'LIST' && <ListPanelPlaceholder files={droppedFiles} />}
            {activeTab === 'HISTORY' && <HistoryPanel />}
            {activeTab === 'SETTINGS' && <SettingsPanel />}
          </GlobalDropZone>
        </div>
      </div>

      <FormatEditorModal
        isOpen={isFormatEditorOpen}
        initialExpression={formatExpression}
        onSave={(expression) => {
          setFormatExpression(expression);
          settingsApi
            .getSettings()
            .then((settings) => settingsApi.updateSettings({ ...settings, tvFormat: expression }))
            .catch(() => {
              // Non-fatal: the expression is still applied for this session even if it can't
              // be persisted back to Settings.
            });
        }}
        onClose={() => setIsFormatEditorOpen(false)}
      />

      <DevLogsModal
        isOpen={isDevLogsOpen}
        onClose={() => setIsDevLogsOpen(false)}
      />
    </div>
  );
};

export default AppShell;

