import React, { useEffect, useState, useCallback } from 'react';
import { HistoryTransaction } from '../types';
import { historyApi } from '../api/client';
import { History, RotateCcw, Download, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const HistoryPanel: React.FC = () => {
  const [transactions, setTransactions] = useState<HistoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await historyApi.getHistory();
      setTransactions(data || []);
    } catch (err) {
      console.error('Failed to load history', err);
      setStatusMessage('Failed to load transaction history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRollbackRow = async (transactionId: string, targetPath: string) => {
    setRollingBackId(`${transactionId}-${targetPath}`);
    setStatusMessage(`Rolling back: ${targetPath.replace(/^.*[\\/]/, '')}...`);
    try {
      const result = await historyApi.rollbackTransaction(transactionId, [targetPath]);
      if (result.failureCount > 0) {
        setStatusMessage(`Rollback warning: ${result.failureCount} file(s) failed to revert.`);
      } else {
        setStatusMessage(`Successfully rolled back ${result.successCount} file(s).`);
      }
      await loadHistory();
    } catch (err) {
      setStatusMessage('Rollback request failed on backend.');
    } finally {
      setRollingBackId(null);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all recorded history?')) return;
    try {
      await historyApi.clearHistory();
      setTransactions([]);
      setStatusMessage('Transaction history cleared.');
    } catch (err) {
      setStatusMessage('Failed to clear history.');
    }
  };

  const handleExportHistory = async () => {
    try {
      await historyApi.exportHistory('xml');

      // Generate downloadable XML for browser
      const xmlDoc = ['<?xml version="1.0" encoding="UTF-8"?>', '<history>'];
      transactions.forEach((tx) => {
        xmlDoc.push(`  <sequence date="${new Date(tx.timestamp).toISOString()}">`);
        tx.elements.forEach((elem) => {
          xmlDoc.push(`    <element from="${escapeXml(elem.sourcePath)}" to="${escapeXml(elem.targetPath)}" action="${elem.action}" />`);
        });
        xmlDoc.push('  </sequence>');
      });
      xmlDoc.push('</history>');

      const blob = new Blob([xmlDoc.join('\n')], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filebot-history-${Date.now()}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage('History exported successfully as XML.');
    } catch (err) {
      setStatusMessage('Failed to export history.');
    }
  };

  const escapeXml = (unsafe: string): string => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  const totalElements = transactions.reduce((acc, tx) => acc + tx.elements.length, 0);

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-950 text-slate-100 overflow-hidden">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-semibold text-slate-200">Rename Operation History & Rollback</span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
            {totalElements} operation{totalElements === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadHistory}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportHistory}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Export XML
          </button>

          <button
            onClick={handleClearHistory}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-red-950/40 disabled:opacity-50 text-slate-300 hover:text-red-400 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 hover:border-red-900/50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            Clear History
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {statusMessage && (
        <div className="text-xs bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
            {statusMessage}
          </span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-500 hover:text-slate-300 text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <th className="p-3 w-44">Timestamp</th>
              <th className="p-3">Source File Path</th>
              <th className="p-3">Renamed Target Path</th>
              <th className="p-3 w-28 text-center">Action</th>
              <th className="p-3 w-28 text-center">Rollback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <History className="w-8 h-8 text-slate-700 stroke-1" />
                    <div>No historical rename transactions recorded yet.</div>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.flatMap((tx) =>
                tx.elements.map((elem, idx) => {
                  const isRolling = rollingBackId === `${tx.transactionId}-${elem.targetPath}`;
                  return (
                    <tr key={`${tx.transactionId}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-slate-300 truncate max-w-xs" title={elem.sourcePath}>
                        {elem.sourcePath}
                      </td>
                      <td className="p-3 font-mono text-blue-400 font-medium truncate max-w-xs" title={elem.targetPath}>
                        {elem.targetPath}
                      </td>
                      <td className="p-3 text-center text-slate-400 font-bold uppercase">{elem.action}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleRollbackRow(tx.transactionId, elem.targetPath)}
                          disabled={isRolling}
                          className="flex items-center gap-1.5 bg-amber-600/20 hover:bg-amber-600/40 disabled:opacity-50 text-amber-300 px-2.5 py-1 rounded text-[11px] font-medium transition-colors mx-auto"
                        >
                          <RotateCcw className={`w-3 h-3 ${isRolling ? 'animate-spin' : ''}`} />
                          {isRolling ? 'Reverting...' : 'Undo'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
