import React from 'react';
import { Match } from '../types';
import { ArrowUp, ArrowDown, XCircle } from 'lucide-react';

interface MatchTableProps {
  matches: Match[];
  onShiftRow: (index: number, direction: 'UP' | 'DOWN') => void;
  onExcludeRow: (index: number) => void;
}

export const MatchTable: React.FC<MatchTableProps> = ({ matches, onShiftRow, onExcludeRow }) => {
  return (
    <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-lg">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
            <th className="p-3 w-12">#</th>
            <th className="p-3">Original Source File</th>
            <th className="p-3 w-16 text-center">Score</th>
            <th className="p-3">New Formatted Target Name</th>
            <th className="p-3 w-28 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {matches.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-slate-500">
                No files added. Drag & drop files here to match.
              </td>
            </tr>
          ) : (
            matches.map((match, idx) => (
              <tr key={match.matchId} className={`hover:bg-slate-800/40 transition-colors ${match.isExcluded ? 'opacity-40' : ''}`}>
                <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                <td className="p-3 font-mono text-slate-300 truncate max-w-xs" title={match.sourceFile.path}>
                  {match.sourceFile.name}
                </td>
                <td className="p-3 text-center font-bold">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] ${
                      match.score >= 0.8 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {Math.round(match.score * 100)}%
                  </span>
                </td>
                <td className="p-3 font-mono text-blue-400 font-medium truncate max-w-xs" title={match.formattedPath}>
                  {match.formattedName}
                </td>
                <td className="p-3 text-center space-x-1">
                  <button
                    onClick={() => onShiftRow(idx, 'UP')}
                    disabled={idx === 0}
                    className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onShiftRow(idx, 'DOWN')}
                    disabled={idx === matches.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onExcludeRow(idx)} className="p-1 text-red-400 hover:text-red-300">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
