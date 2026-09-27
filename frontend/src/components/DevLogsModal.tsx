import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiLogger, ApiLogEntry } from '../utils/apiLogger';
import { websocketClient, WebSocketStatus } from '../api/websocketClient';
import {
  X,
  Trash2,
  Copy,
  Check,
  Search,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Wifi,
  WifiOff,
  Clock,
  Code2,
  AlertTriangle,
} from 'lucide-react';

interface DevLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevLogsModal: React.FC<DevLogsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'REST' | 'WS' | 'ERRORS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('DISCONNECTED');
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const logListRef = useRef<HTMLDivElement>(null);

  // Subscribe to apiLogger
  useEffect(() => {
    const unsubscribe = apiLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  // Subscribe to WebSocket status
  useEffect(() => {
    const unsubscribe = websocketClient.onStatusChange(setWsStatus);
    return unsubscribe;
  }, []);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType === 'REST' && log.type !== 'REST') return false;
      if (filterType === 'WS' && log.type !== 'WS') return false;
      if (filterType === 'ERRORS' && !log.isError) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesUrl = log.urlOrDestination.toLowerCase().includes(query);
        const matchesMethod = log.methodOrTopic.toLowerCase().includes(query);
        const matchesBody =
          log.requestData && JSON.stringify(log.requestData).toLowerCase().includes(query);
        const matchesResponse =
          log.responseData && JSON.stringify(log.responseData).toLowerCase().includes(query);

        return matchesUrl || matchesMethod || matchesBody || matchesResponse;
      }
      return true;
    });
  }, [logs, filterType, searchQuery]);

  // Auto-select latest log if none selected or if selected is removed
  useEffect(() => {
    if (filteredLogs.length > 0 && (!selectedLogId || !logs.find((l) => l.id === selectedLogId))) {
      setSelectedLogId(filteredLogs[0].id);
    }
  }, [filteredLogs, selectedLogId, logs]);

  const selectedLog = useMemo(() => {
    return logs.find((l) => l.id === selectedLogId) || null;
  }, [logs, selectedLogId]);

  const handleCopyJson = (data: any, sectionName?: string) => {
    if (!data) return;
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonStr);

    if (sectionName) {
      setCopiedSection(sectionName);
      setTimeout(() => setCopiedSection(null), 1800);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#1e1e1e] text-[#cccccc] border border-[#3e3e42] rounded-lg shadow-2xl w-[95vw] max-w-6xl h-[88vh] flex flex-col overflow-hidden font-sans">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#252526] border-b border-[#333333] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-white font-medium text-sm">
              <Code2 className="w-4 h-4 text-sky-400" />
              <span>Dev Debugger: REST &amp; WebSocket Inspector</span>
            </div>

            {/* WebSocket Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border ${
                wsStatus === 'CONNECTED'
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                  : wsStatus === 'CONNECTING'
                  ? 'bg-amber-950/80 text-amber-400 border-amber-700/60'
                  : 'bg-rose-950/80 text-rose-400 border-rose-700/60'
              }`}
              title={`WebSocket status: ${wsStatus}`}
            >
              {wsStatus === 'CONNECTED' ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span>WS: {wsStatus}</span>
            </div>

            <span className="text-xs text-[#858585] font-mono">
              ({logs.length} logged)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyJson(logs)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#333333] hover:bg-[#3e3e42] active:bg-[#444444] text-[#cccccc] hover:text-white rounded border border-[#444444] transition-colors"
              title="Copy all logs as JSON"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Export Logs'}</span>
            </button>

            <button
              onClick={() => apiLogger.clearLogs()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#333333] hover:bg-rose-900/60 active:bg-rose-800 text-[#cccccc] hover:text-rose-200 rounded border border-[#444444] transition-colors"
              title="Clear all logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#333333] transition-colors ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#333333] gap-4 shrink-0 text-xs">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'ALL', label: 'All Events' },
                { id: 'REST', label: 'REST API' },
                { id: 'WS', label: 'WebSocket' },
                { id: 'ERRORS', label: 'Errors' },
              ] as const
            ).map((tab) => {
              const count =
                tab.id === 'ALL'
                  ? logs.length
                  : tab.id === 'REST'
                  ? logs.filter((l) => l.type === 'REST').length
                  : tab.id === 'WS'
                  ? logs.filter((l) => l.type === 'WS').length
                  : logs.filter((l) => l.isError).length;

              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1 rounded transition-colors ${
                    isActive
                      ? 'bg-[#007acc] text-white font-medium shadow-sm'
                      : 'text-[#999999] hover:bg-[#383838] hover:text-[#e0e0e0]'
                  }`}
                >
                  {tab.label} <span className="opacity-75 font-mono ml-0.5">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-[#858585] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by endpoint, body, or status..."
              className="w-full pl-8 pr-3 py-1 bg-[#1e1e1e] border border-[#3e3e42] rounded text-xs text-[#cccccc] placeholder-[#666666] outline-none focus:border-[#007acc]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#858585] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Master-Detail Split Pane */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Master List */}
          <div
            ref={logListRef}
            className="w-[45%] border-r border-[#333333] overflow-y-auto bg-[#1e1e1e] flex flex-col divide-y divide-[#2a2a2a]"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#666666]">
                <Activity className="w-8 h-8 mb-2 opacity-30" />
                <span>No API or WebSocket calls recorded yet</span>
                <span className="text-[11px] mt-1 text-[#555555]">
                  Interact with the app or drop files to view traffic
                </span>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSelected = selectedLogId === log.id;
                const isRest = log.type === 'REST';

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`p-2.5 cursor-pointer text-xs font-mono transition-colors flex flex-col gap-1 select-none ${
                      isSelected
                        ? 'bg-[#094771] text-white'
                        : log.isError
                        ? 'bg-rose-950/20 hover:bg-rose-950/40 text-rose-200'
                        : 'hover:bg-[#2a2d2e] text-[#cccccc]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Type & Method / Event Badge */}
                        {isRest ? (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              log.methodOrTopic === 'GET'
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                : log.methodOrTopic === 'POST'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : log.methodOrTopic === 'DELETE'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {log.methodOrTopic}
                          </span>
                        ) : (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold flex items-center gap-1 ${
                              log.subtype === 'RECEIVE'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : log.subtype === 'SEND'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {log.subtype === 'RECEIVE' ? (
                              <ArrowDownCircle className="w-2.5 h-2.5" />
                            ) : log.subtype === 'SEND' ? (
                              <ArrowUpCircle className="w-2.5 h-2.5" />
                            ) : null}
                            WS {log.subtype}
                          </span>
                        )}

                        <span className="truncate font-medium text-[11px]" title={log.urlOrDestination}>
                          {log.urlOrDestination}
                        </span>
                      </div>

                      {/* Status / Timing */}
                      <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                        {log.status !== undefined && (
                          <span
                            className={`px-1 py-0.2 rounded font-semibold ${
                              typeof log.status === 'number'
                                ? log.status < 300
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : log.status < 400
                                  ? 'bg-amber-950 text-amber-300'
                                  : 'bg-rose-950 text-rose-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        )}
                        {log.durationMs !== undefined && (
                          <span className="text-[#888888]">{log.durationMs}ms</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#777777]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {log.timeString}
                      </span>
                      {log.isError && (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Error
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Detail Inspector */}
          <div className="flex-1 overflow-y-auto bg-[#181818] p-4 flex flex-col gap-4 font-mono text-xs">
            {selectedLog ? (
              <>
                {/* Summary Header */}
                <div className="bg-[#252526] p-3 rounded border border-[#333333] flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#007acc] text-white rounded text-[11px] font-bold">
                        {selectedLog.type}
                      </span>
                      <span className="text-sm text-white font-semibold">
                        {selectedLog.methodOrTopic} {selectedLog.urlOrDestination}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedLog.durationMs !== undefined && (
                        <span className="px-2 py-0.5 bg-[#333333] text-slate-300 rounded text-[11px]">
                          Duration: {selectedLog.durationMs}ms
                        </span>
                      )}
                      {selectedLog.status !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            typeof selectedLog.status === 'number' && selectedLog.status < 300
                              ? 'bg-emerald-900 text-emerald-200'
                              : 'bg-rose-900 text-rose-200'
                          }`}
                        >
                          Status: {selectedLog.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-[#888888] flex items-center gap-4">
                    <span>Recorded at: {selectedLog.timeString}</span>
                    <span>Event ID: {selectedLog.id}</span>
                  </div>
                </div>

                {/* Request / Outbound Details */}
                {(selectedLog.requestData || selectedLog.headers) && (
                  <div className="bg-[#1f1f1f] rounded border border-[#333333] overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[#2a2a2a] border-b border-[#333333]">
                      <span className="font-semibold text-slate-300 text-[11px]">
                        {selectedLog.type === 'REST' ? 'Request Data & Parameters' : 'Outbound Payload'}
                      </span>
                      <button
                        onClick={() => handleCopyJson(selectedLog.requestData, 'request')}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                        title="Copy request data"
                      >
                        {copiedSection === 'request' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedSection === 'request' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="p-3 text-[11px] text-[#9cdcfe] overflow-x-auto whitespace-pre-wrap max-h-72">
                      {JSON.stringify(selectedLog.requestData, null, 2) || '(Empty)'}
                    </pre>
                  </div>
                )}

                {/* Response / Inbound Details */}
                <div className="bg-[#1f1f1f] rounded border border-[#333333] overflow-hidden flex-1 flex flex-col min-h-48">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#2a2a2a] border-b border-[#333333] shrink-0">
                    <span className="font-semibold text-slate-300 text-[11px]">
                      {selectedLog.type === 'REST' ? 'Response Payload' : 'Inbound Topic Message'}
                    </span>
                    <button
                      onClick={() => handleCopyJson(selectedLog.responseData, 'response')}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                      title="Copy response payload"
                    >
                      {copiedSection === 'response' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedSection === 'response' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre
                    className={`p-3 text-[11px] overflow-auto flex-1 whitespace-pre-wrap ${
                      selectedLog.isError ? 'text-rose-300' : 'text-[#ce9178]'
                    }`}
                  >
                    {typeof selectedLog.responseData === 'string'
                      ? selectedLog.responseData
                      : JSON.stringify(selectedLog.responseData, null, 2) || '(No response body)'}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#666666]">
                Select a log entry from the list to inspect details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
