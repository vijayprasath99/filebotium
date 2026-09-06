import React, { useState } from 'react';
import { EpisodeBindingsModal } from './EpisodeBindingsModal';
import { X, CheckCircle2, XCircle, Copy, FolderOpen, ListTree, Tv, Film } from 'lucide-react';

interface FormatEditorModalProps {
  isOpen: boolean;
  initialExpression: string;
  onSave: (expression: string) => void;
  onClose: () => void;
}

const EXAMPLES = [
  { expr: '{n} - {s00e00} - {t}', preview: 'Firefly - S01E01 - Serenity' },
  { expr: '{n} - {sxe} - {t}', preview: 'Firefly - 1x01 - Serenity' },
  { expr: '{n} ({airdate}) {t}', preview: 'Firefly (2002-12-20) Serenity' },
  { expr: "{n.space('.')}-lower() {t.te} {e.pad(2)}", preview: 'firefly.101' },
  { expr: "{ny}/{'Season '+s}/{n} - {s00e00} - {t}", preview: 'Firefly (2002)/Season 1/Firefly - S01E01 - Serenity' },
  { expr: '{drive}/Media/TV Shows/{n} - {s00e00}', preview: 'Z:/Media/TV Shows/Firefly - S01E01 - Serenity' },
];

export const FormatEditorModal: React.FC<FormatEditorModalProps> = ({
  isOpen,
  initialExpression,
  onSave,
  onClose,
}) => {
  const [expression, setExpression] = useState(
    initialExpression || '{ drive }/media/tv/{ ~plex.year.id }'
  );
  const [mode, setMode] = useState<'tv' | 'movie'>('tv');
  const [isBindingsOpen, setIsBindingsOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  // Simple dynamic preview simulation
  const getDynamicPreview = (expr: string) => {
    if (expr.includes('plex.year.id')) {
      return 'Z:/media/tv/Firefly (2002) {tmdb-1437}/Season 01/Firefly (2002) - S01E01 - Serenity';
    }
    if (expr.includes('s00e00')) {
      return 'Firefly - S01E01 - Serenity';
    }
    if (expr.includes('sxe')) {
      return 'Firefly - 1x01 - Serenity';
    }
    if (expr.includes('firefly.101') || expr.includes('lower()')) {
      return 'firefly.101';
    }
    return 'Firefly (2002)/Season 01/Firefly (2002) - S01E01 - Serenity';
  };

  const handleInsertBinding = (binding: string) => {
    setExpression((prev) => prev.trim() + ' ' + binding);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
        <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
          {/* Title Bar */}
          <div className="px-4 py-2 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Episode Format</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4 bg-slate-900">
            {/* Top Preview Section */}
            <div>
              <span className="text-xs font-bold text-slate-300 block mb-1">Episode Format</span>
              <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded font-mono text-xs text-slate-200 break-all leading-relaxed">
                <span className="text-blue-400 border-b-2 border-blue-500 pb-0.5">Z:/media/tv/</span>
                <span className="text-emerald-400 border-b-2 border-emerald-500 pb-0.5 ml-1">
                  {getDynamicPreview(expression).replace('Z:/media/tv/', '')}
                </span>
              </div>
            </div>

            {/* Format Input Field with side icons */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-950 border border-slate-700 rounded p-2.5 font-mono text-xs text-amber-300 focus-within:border-blue-500">
                <input
                  type="text"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  className="w-full bg-transparent outline-none"
                  placeholder="{ drive }/media/tv/{ ~plex.year.id }"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigator.clipboard?.writeText(expression)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors"
                  title="Copy Expression"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setExpression('{n} - {s00e00} - {t}')}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors"
                  title="Load Preset"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsBindingsOpen(true)}
                  className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors shadow-sm"
                  title="Open Episode Bindings"
                >
                  <ListTree className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Syntax Explanation */}
            <div className="bg-slate-950/40 p-3 rounded border border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Syntax</span>
              <p className="font-mono text-xs text-slate-300">
                <span className="text-amber-400">{`{ }`}</span> ... expression, <span className="text-amber-400">n</span> ... name, <span className="text-amber-400">s</span> ... season, <span className="text-amber-400">e</span> ... episode, <span className="text-amber-400">t</span> ... title
              </p>
            </div>

            {/* Examples Section */}
            <div className="bg-slate-950/40 p-3 rounded border border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Examples</span>
              <div className="space-y-1.5 font-mono text-[11px]">
                {EXAMPLES.map((ex, idx) => (
                  <div
                    key={idx}
                    onClick={() => setExpression(ex.expr)}
                    className="flex items-center justify-between text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 p-1 rounded cursor-pointer transition-colors"
                  >
                    <span className="text-amber-400/90 hover:underline">{ex.expr}</span>
                    <span className="text-slate-500 text-right truncate max-w-xs ml-2">... {ex.preview}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMode('tv')}
                className={`p-1.5 rounded transition-colors ${
                  mode === 'tv' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="TV Shows Format"
              >
                <Tv className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode('movie')}
                className={`p-1.5 rounded transition-colors ${
                  mode === 'movie' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Movie Format"
              >
                <Film className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
              >
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                Cancel
              </button>
              <button
                onClick={() => {
                  onSave(expression);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Use Format
              </button>
            </div>
          </div>
        </div>
      </div>

      <EpisodeBindingsModal
        isOpen={isBindingsOpen}
        onClose={() => setIsBindingsOpen(false)}
        onSelectBinding={handleInsertBinding}
      />
    </>
  );
};
