import React, { useEffect, useState } from 'react';
import { HistoryTransaction } from '../types';
import { historyApi } from '../api/client';
import { History, RotateCcw } from 'lucide-react';

export const HistoryPanel: React.FC = () => {
  const [transactions, setTransactions] = useState<HistoryTransaction[]>([]);

  useEffect(() => {
    historyApi.getHistory().then(setTransactions).catch(console.error);
  }, []);

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-950 text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-semibold text-slate-200">Rename Operation History & Rollback</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <th className="p-3 w-44">Timestamp</th>
              <th className="p-3">Source File Path</th>
              <th className="p-3">Renamed Target Path</th>
              <th className="p-3 w-28 text-center">Action</th>
              <th className="p-3 w-24 text-center">Rollback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No historical rename transactions recorded.
                </td>
              </tr>
            ) : (
              transactions.flatMap((tx) =>
                tx.elements.map((elem, idx) => (
                  <tr key={tx.transactionId + '-' + idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{new Date(tx.timestamp).toLocaleString()}</td>
                    <td className="p-3 font-mono text-slate-300 truncate max-w-xs">{elem.sourcePath}</td>
                    <td className="p-3 font-mono text-blue-400 font-medium truncate max-w-xs">{elem.targetPath}</td>
                    <td className="p-3 text-center text-slate-400 font-bold uppercase">{elem.action}</td>
                    <td className="p-3 text-center">
                      <button className="flex items-center gap-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 px-2 py-1 rounded text-[10px] transition-colors mx-auto">
                        <RotateCcw className="w-3 h-3" />
                        Undo
                      </button>
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
