import React, { useState } from 'react';
import { X, CheckCircle2, FileText } from 'lucide-react';

interface EpisodeBindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBinding: (expression: string) => void;
}

interface BindingRow {
  expression: string;
  value: string;
}

const DEFAULT_BINDINGS: BindingRow[] = [
  { expression: 'plex', value: 'TV Shows/Firefly/Season 01/Firefly - S01E01 - Serenity' },
  { expression: 'plex.year', value: 'TV Shows/Firefly (2002)/Season 01/Firefly (2002) - S01E01 - Serenity' },
  { expression: 'plex.id', value: 'TV Shows/Firefly {tmdb-1437}/Season 01/Firefly - S01E01 - Serenity' },
  { expression: 'plex.year.id', value: 'TV Shows/Firefly (2002) {tmdb-1437}/Season 01/Firefly (2002) - S01E01 - Serenity' },
  { expression: '-plex.id', value: '-plex.id' },
  { expression: 'plex.name', value: 'Firefly - S01E01 - Serenity' },
  { expression: 'plex.year.name', value: 'Firefly (2002) - S01E01 - Serenity' },
  { expression: 'n', value: 'Firefly' },
  { expression: 's', value: '1' },
  { expression: 'e', value: '1' },
  { expression: 's00e00', value: 'S01E01' },
  { expression: 't', value: 'Serenity' },
  { expression: 'airdate', value: '2002-12-20' },
  { expression: 'y', value: '2002' },
  { expression: 'source', value: 'Bluray' },
  { expression: 'vc', value: 'x264' },
  { expression: 'ac', value: 'AC3' },
  { expression: 'channels', value: '5.1' },
];

export const EpisodeBindingsModal: React.FC<EpisodeBindingsModalProps> = ({
  isOpen,
  onClose,
  onSelectBinding,
}) => {
  const [matchObject, setMatchObject] = useState('Firefly - 1x01 - Serenity');
  const [mediaFile, setMediaFile] = useState('Z:\\Current\\Firefly.1x01.mkv');
  const [selectedRow, setSelectedRow] = useState<string>('plex.year.id');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">Episode Bindings</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="p-4 space-y-3 bg-slate-900 border-b border-slate-800 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bindings</span>
          
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Match Object</label>
            <input
              type="text"
              value={matchObject}
              onChange={(e) => setMatchObject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Media File</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={mediaFile}
                onChange={(e) => setMediaFile(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:border-blue-500"
              />
              <button className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors" title="Browse File">
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className="flex-1 overflow-auto max-h-72 p-4 bg-slate-950/60">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Preview:</span>
          <div className="border border-slate-800 rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-3 w-36 font-semibold">Expression</th>
                  <th className="py-2 px-3 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {DEFAULT_BINDINGS.map((row) => {
                  const isSelected = selectedRow === row.expression;
                  return (
                    <tr
                      key={row.expression}
                      onClick={() => {
                        setSelectedRow(row.expression);
                        onSelectBinding(`{ ${row.expression} }`);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium'
                          : 'hover:bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <td className="py-1.5 px-3">{row.expression}</td>
                      <td className="py-1.5 px-3 truncate max-w-xs">{row.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
