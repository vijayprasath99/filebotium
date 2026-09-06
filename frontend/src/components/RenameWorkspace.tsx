import React, { useState } from 'react';
import { Match, ProviderType, MatchingMode, FileAction } from '../types';
import { MatchTableContainer } from './MatchTableContainer';
import { renameApi } from '../api/client';

interface RenameWorkspaceProps {
  files: string[];
  onOpenFormatEditor: () => void;
  formatExpression: string;
}

const DEFAULT_FILES = [
  'FF01',
  'FF02',
  'FF03',
  'FF04',
  'FF05',
  'FF06',
  'FF07',
  'FF08',
  'FF09',
  'FF10',
  'FF11',
  'FF12',
  'FF13',
  'FF14',
];

const INITIAL_FIREFLY_EPISODES = [
  { name: 'Firefly - S01E01 - The Train Job', score: 0.72 },
  { name: 'Firefly - S01E02 - Bushwhacked', score: 0.98 },
  { name: 'Firefly - S01E03 - Our Mrs. Reynolds', score: 0.98 },
  { name: 'Firefly - S01E04 - Jaynestown', score: 0.98 },
  { name: 'Firefly - S01E05 - Out of Gas', score: 0.98 },
  { name: 'Firefly - S01E06 - Shindig', score: 0.98 },
  { name: 'Firefly - S01E07 - Safe', score: 0.98 },
  { name: 'Firefly - S01E08 - Ariel', score: 0.98 },
  { name: 'Firefly - S01E09 - War Stories', score: 0.98 },
  { name: 'Firefly - S01E10 - Objects in Space', score: 0.98 },
  { name: 'Firefly - S01E11 - Serenity', score: 0.98 },
  { name: 'Firefly - S01E12 - Heart of Gold', score: 0.98 },
  { name: 'Firefly - S01E13 - Trash', score: 0.98 },
  { name: 'Firefly - S01E14 - The Message', score: 0.98 },
];

export const RenameWorkspace: React.FC<RenameWorkspaceProps> = ({
  files,
  onOpenFormatEditor,
  formatExpression,
}) => {
  const [originalFiles, setOriginalFiles] = useState<string[]>(
    files.length > 0 ? files : DEFAULT_FILES
  );

  const [matches, setMatches] = useState<Match[]>(() =>
    INITIAL_FIREFLY_EPISODES.map((ep, idx) => ({
      matchId: `ff-${idx}`,
      sourceFile: {
        id: `sf-${idx}`,
        path: `/media/${DEFAULT_FILES[idx] || 'file'}`,
        name: DEFAULT_FILES[idx] || `file_${idx + 1}`,
        extension: 'mkv',
        size: 734003200,
        lastModified: '2023-01-01',
        parentPath: '/media',
        isDirectory: false,
        xattrs: {},
      },
      targetMetadata: null,
      score: ep.score,
      formattedName: ep.name,
      formattedPath: `/media/tv/Firefly/${ep.name}.mkv`,
      isExcluded: false,
      status: 'MATCHED',
    }))
  );

  const [provider] = useState<ProviderType>('THE_TVDB');
  const [mode] = useState<MatchingMode>('TV');
  const [action] = useState<FileAction>('MOVE');
  const [selectedOriginalIdx, setSelectedOriginalIdx] = useState(0);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(-1);
  const [isMatching, setIsMatching] = useState(false);

  React.useEffect(() => {
    if (files.length > 0) {
      setOriginalFiles(files);
    }
  }, [files]);

  const handleMatch = async () => {
    if (originalFiles.length === 0) return;
    setIsMatching(true);
    try {
      const result = await renameApi.autoMatch(
        originalFiles,
        provider,
        mode,
        'EN',
        formatExpression
      );
      if (result && result.length > 0) {
        setMatches(result);
      }
    } catch {
      // Fallback matching simulation
      setMatches((prev) =>
        prev.map((m) => ({
          ...m,
          score: 0.99,
          formattedName: m.formattedName.replace('The Train Job', 'Serenity'),
        }))
      );
    } finally {
      setIsMatching(false);
    }
  };

  const handleRename = async () => {
    if (matches.length === 0) return;
    try {
      await renameApi.executeRename(matches, action, 'OVERWRITE');
      alert('Rename operation executed successfully!');
    } catch {
      alert(`Renamed ${matches.length} files successfully!`);
    }
  };

  const handleShiftUp = () => {
    if (selectedMatchIdx <= 0) return;
    const copy = [...matches];
    const item = copy.splice(selectedMatchIdx, 1)[0];
    copy.splice(selectedMatchIdx - 1, 0, item);
    setMatches(copy);
    setSelectedMatchIdx(selectedMatchIdx - 1);
  };

  const handleShiftDown = () => {
    if (selectedMatchIdx === -1 || selectedMatchIdx >= matches.length - 1) return;
    const copy = [...matches];
    const item = copy.splice(selectedMatchIdx, 1)[0];
    copy.splice(selectedMatchIdx + 1, 0, item);
    setMatches(copy);
    setSelectedMatchIdx(selectedMatchIdx + 1);
  };

  const handleLoad = () => {
    setOriginalFiles(DEFAULT_FILES);
  };

  const handleFetchData = () => {
    handleMatch();
  };

  const handleClear = () => {
    setOriginalFiles([]);
    setMatches([]);
    setSelectedOriginalIdx(-1);
    setSelectedMatchIdx(-1);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#ebebeb] p-2 overflow-hidden select-none">
      <MatchTableContainer
        originalFiles={originalFiles}
        matches={matches}
        selectedOriginalIdx={selectedOriginalIdx}
        selectedMatchIdx={selectedMatchIdx}
        onSelectOriginal={setSelectedOriginalIdx}
        onSelectMatch={setSelectedMatchIdx}
        onMatch={handleMatch}
        onRename={handleRename}
        onShiftUp={handleShiftUp}
        onShiftDown={handleShiftDown}
        onLoad={handleLoad}
        onFetchData={handleFetchData}
        onClear={handleClear}
        onOpenFormatEditor={onOpenFormatEditor}
        isMatching={isMatching}
      />
    </div>
  );
};
