import React, { useState } from 'react';
import { Match, ProviderType, MatchingMode, FileAction, ConflictStrategy } from '../types';
import { MatchTable } from './MatchTable';
import { renameApi } from '../api/client';
import { Play, Sparkles, Code } from 'lucide-react';

interface RenameWorkspaceProps {
  files: string[];
  onOpenFormatEditor: () => void;
  formatExpression: string;
}

export const RenameWorkspace: React.FC<RenameWorkspaceProps> = ({ files, onOpenFormatEditor, formatExpression }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [provider, setProvider] = useState<ProviderType>('THE_TVDB');
  const [mode, setMode] = useState<MatchingMode>('TV');
  const [action, setAction] = useState<FileAction>('MOVE');
  const [isMatching, setIsMatching] = useState(false);

  const handleMatch = async () => {
    if (files.length === 0) return;
    setIsMatching(true);
    try {
      const result = await renameApi.autoMatch(files, provider, mode, 'EN', formatExpression);
      setMatches(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsMatching(false);
    }
  };

  const handleExecute = async () => {
    if (matches.length === 0) return;
    try {
      await renameApi.executeRename(matches, action, 'OVERWRITE');
      alert('Rename operation executed successfully!');
    } catch (e) {
      alert('Error executing rename');
    }
  };

  const handleShiftRow = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= matches.length) return;
    const copy = [...matches];
    const item = copy.splice(index, 1)[0];
    copy.splice(targetIdx, 0, item);
    setMatches(copy);
  };

  const handleExcludeRow = (index: number) => {
    const copy = [...matches];
    copy[index].isExcluded = !copy[index].isExcluded;
    setMatches(copy);
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-950 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderType)}
            className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 outline-none"
          >
            <option value="THE_TVDB">TheTVDB</option>
            <option value="THE_MOVIE_DB">TheMovieDB</option>
            <option value="ANI_DB">AniDB</option>
            <option value="TV_MAZE">TVMaze</option>
            <option value="OMDB">OMDb</option>
          </select>

          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as MatchingMode)}
            className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 outline-none"
          >
            <option value="TV">TV Mode</option>
            <option value="MOVIE">Movie Mode</option>
            <option value="MUSIC">Music Mode</option>
            <option value="ANIME">Anime Mode</option>
            <option value="AUTO">Auto Detect</option>
          </select>

          <button
            onClick={handleMatch}
            disabled={isMatching || files.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {isMatching ? 'Matching...' : 'Auto Match'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenFormatEditor}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <Code className="w-4 h-4 text-amber-400" />
            Format
          </button>

          <select
            value={action}
            onChange={(e) => setAction(e.target.value as FileAction)}
            className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 outline-none"
          >
            <option value="MOVE">Move</option>
            <option value="COPY">Copy</option>
            <option value="HARDLINK">Hardlink</option>
            <option value="SYMLINK">Symlink</option>
          </select>

          <button
            onClick={handleExecute}
            disabled={matches.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
          >
            <Play className="w-4 h-4 fill-white" />
            Rename
          </button>
        </div>
      </div>

      <MatchTable matches={matches} onShiftRow={handleShiftRow} onExcludeRow={handleExcludeRow} />
    </div>
  );
};
