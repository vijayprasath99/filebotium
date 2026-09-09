import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, FileText } from 'lucide-react';
import { BindingDocumentation } from '../types';
import { formatApi } from '../api/client';
import { getFilePath } from '../utils/fileUtils';

interface EpisodeBindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBinding: (expression: string) => void;
}

export const EpisodeBindingsModal: React.FC<EpisodeBindingsModalProps> = ({
  isOpen,
  onClose,
  onSelectBinding,
}) => {
  const [mediaFile, setMediaFile] = useState('');
  const [bindings, setBindings] = useState<BindingDocumentation[]>([]);
  const [selectedRow, setSelectedRow] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadError(null);
      formatApi
        .getBindings(mediaFile || undefined)
        .then((data) => {
          if (data && data.length > 0) {
            setBindings(data);
          }
        })
        .catch((err) => {
          console.error('Failed to load bindings:', err);
          setLoadError('Failed to load bindings from server. The backend may be unavailable.');
        });
    }
  }, [isOpen, mediaFile]);

  if (!isOpen) return null;

  const handleBrowseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const path = getFilePath(file);
      setMediaFile(path);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
      />
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
            <label className="text-[11px] text-slate-400 block mb-1">Media File (optional sample for context)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={mediaFile}
                onChange={(e) => setMediaFile(e.target.value)}
                placeholder="Select or enter sample media file path..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:border-blue-500"
              />
              <button
                onClick={handleBrowseFile}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors cursor-pointer"
                title="Browse Sample File"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className="flex-1 overflow-auto max-h-72 p-4 bg-slate-950/60">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Available Bindings ({bindings.length})
          </span>
          <div className="border border-slate-800 rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-3 w-32 font-semibold">Expression</th>
                  <th className="py-2 px-3 font-semibold">Description</th>
                  <th className="py-2 px-3 w-28 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loadError ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-red-400">
                      {loadError}
                    </td>
                  </tr>
                ) : bindings.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-500">
                      Loading available bindings from backend...
                    </td>
                  </tr>
                ) : (
                  bindings.map((row) => {
                    const isSelected = selectedRow === row.bindingKey;
                    return (
                      <tr
                        key={row.bindingKey}
                        onClick={() => {
                          setSelectedRow(row.bindingKey);
                          onSelectBinding(`{ ${row.bindingKey} }`);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white font-medium'
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <td className="py-1.5 px-3 text-amber-400 font-bold">{row.bindingKey}</td>
                        <td className="py-1.5 px-3 truncate max-w-xs">{row.description}</td>
                        <td className="py-1.5 px-3 text-slate-400 truncate">{row.exampleValue}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
