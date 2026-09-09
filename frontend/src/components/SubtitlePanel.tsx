import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  Globe,
  Download,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';
import { SubtitleDescriptor, LanguageCode, SubtitleProviderType } from '../types';
import { subtitleApi, appApi } from '../api/client';
import { getFilePaths } from '../utils/fileUtils';

interface SubtitleRow {
  video: string;
  matchedSubtitle: string | null;
  candidates?: string[];
  expanded?: boolean;
  selectedCandidateIdx?: number;
  descriptor?: SubtitleDescriptor;
}

interface SubtitlePanelProps {
  files?: string[];
}

export const SubtitlePanel: React.FC<SubtitlePanelProps> = ({ files }) => {
  const [rows, setRows] = useState<SubtitleRow[]>([]);
  const [language, setLanguage] = useState<LanguageCode>('EN');
  const [namingFormat, setNamingFormat] = useState('Match Video and Language');
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind: 'info' | 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showStatus = (text: string, kind: 'info' | 'success' | 'error' = 'info') => {
    setStatusMsg({ text, kind });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  useEffect(() => {
    if (files && files.length > 0) {
      setRows((prev) => {
        const existing = new Set(prev.map((r) => r.video));
        const added = files
          .filter((f) => !existing.has(f))
          .map((f) => ({ video: f, matchedSubtitle: null }));
        return [...prev, ...added];
      });
    }
  }, [files]);

  const toggleRowExpanded = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, expanded: !r.expanded } : r))
    );
  };

  const handleSelectCandidate = (rowIdx: number, candidateIdx: number) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        return {
          ...r,
          matchedSubtitle: r.candidates ? r.candidates[candidateIdx] : r.matchedSubtitle,
          selectedCandidateIdx: candidateIdx,
        };
      })
    );
  };

  const handleCancelSelection = (rowIdx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, matchedSubtitle: null } : r))
    );
  };

  const handleLoadVideos = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const rawPaths = getFilePaths(e.target.files);
      try {
        const ingested = await appApi.intakeFiles(rawPaths, 'SUBTITLES');
        const pathsToAdd = ingested && ingested.length > 0 ? ingested.map((f) => f.path) : rawPaths;
        setRows((prev) => [
          ...prev,
          ...pathsToAdd.map((p) => ({ video: p, matchedSubtitle: null })),
        ]);
      } catch {
        setRows((prev) => [
          ...prev,
          ...rawPaths.map((p) => ({ video: p, matchedSubtitle: null })),
        ]);
      }
    }
    if (e.target) e.target.value = '';
  };

  const handleSearchSubtitles = async (isFuzzy: boolean = false) => {
    if (rows.length === 0) {
      showStatus('Please drop or load video files first to search for subtitles.', 'error');
      return;
    }

    setIsSearching(true);
    const videoPaths = rows.map((r) => r.video);
    try {
      const provider: SubtitleProviderType = isFuzzy ? 'SHOOTER' : 'OPEN_SUBTITLES';
      const results = await subtitleApi.searchSubtitles(videoPaths, language, provider);
      setRows((prev) =>
        prev.map((row, idx) => {
          const match = results[idx] || (results.length > 0 ? results[0] : null);
          if (match) {
            const ext = match.name;
            const altCand = match.name.replace(/\.srt$/i, `.${language.toLowerCase()}.srt`);
            return {
              ...row,
              matchedSubtitle: ext,
              candidates: [ext, altCand],
              descriptor: match,
            };
          }
          return row;
        })
      );
      if (results.length === 0) {
        showStatus('No subtitles found for the given files.', 'info');
      }
    } catch (err) {
      console.error('Failed to search subtitles:', err);
      showStatus('Failed to retrieve subtitles from the server.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async () => {
    const matchedRows = rows.filter((r) => r.matchedSubtitle);
    if (matchedRows.length === 0) {
      showStatus('No subtitles selected to download.', 'error');
      return;
    }

    setIsDownloading(true);
    try {
      const requests = matchedRows.map((r) => ({
        videoFilePath: r.video,
        subtitleId: r.descriptor?.id || 'sub-default',
        provider: 'OPEN_SUBTITLES' as const,
        targetFormat: 'SRT' as const,
      }));
      const res = await subtitleApi.downloadSubtitles(requests);
      showStatus(
        `Downloaded ${res.successCount} subtitle(s). Saved: ${res.downloadedSubtitlePaths.join(', ')}`,
        'success'
      );
    } catch (err) {
      console.error('Failed to download subtitles:', err);
      showStatus('Failed to download subtitles.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex-1 p-2 flex flex-col gap-2 bg-[#ebebeb] text-[#222222] overflow-hidden select-none font-sans">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFilesSelected}
        className="hidden"
      />
      {statusMsg && (
        <div
          className={`px-3 py-1.5 rounded text-xs font-sans shrink-0 ${
            statusMsg.kind === 'error'
              ? 'bg-red-100 border border-red-300 text-red-700'
              : statusMsg.kind === 'success'
              ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          {statusMsg.text}
        </div>
      )}
      {/* Table Container matching Screenshot 3 */}
      <div className="flex-1 flex flex-col min-h-0 bg-white border border-[#a8a8a8] rounded-[2px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-2 bg-[#f4f4f4] border-b border-[#c8c8c8] px-3 py-1 text-[11px] font-normal text-[#555555]">
          <div>Video ({rows.length} files)</div>
          <div className="pl-3 border-l border-[#d8d8d8]">Subtitle</div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#ececec] text-[12px] font-sans">
          {rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-sans p-6 text-center gap-2">
              <span>No files or subtitles loaded. Drag & drop video files here or click Load Videos.</span>
              <button
                onClick={handleLoadVideos}
                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#a8a8a8] rounded shadow-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                <span>Load Videos</span>
              </button>
            </div>
          ) : (
            rows.map((row, idx) => (
              <div key={idx} className="flex flex-col">
                <div className="grid grid-cols-2 items-center px-3 py-1 hover:bg-[#f6faff]">
                  {/* Left: Video */}
                  <div className="truncate pr-3 text-[#111111]" title={row.video}>
                    {row.video}
                  </div>

                  {/* Right: Subtitle */}
                  <div className="flex items-center justify-between pl-3 border-l border-[#f0f0f0] min-w-0">
                    {row.matchedSubtitle ? (
                      <div
                        onClick={() => row.candidates && toggleRowExpanded(idx)}
                        className="flex items-center gap-1.5 truncate cursor-pointer text-[#111111]"
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate" title={row.matchedSubtitle}>
                          {row.matchedSubtitle}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#888888] italic text-[11px]">
                        No subtitles searched
                      </span>
                    )}

                    {row.candidates && row.candidates.length > 0 && (
                      <button
                        onClick={() => toggleRowExpanded(idx)}
                        className="p-0.5 text-[#555555] hover:text-black ml-2 transition-colors cursor-pointer"
                      >
                        {row.expanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Sub-Rows for Candidate List */}
                {row.expanded && row.candidates && (
                  <div className="bg-[#fafafa] border-t border-[#e8e8e8] pl-6 pr-3 py-1 space-y-0.5">
                    {row.candidates.map((cand, cIdx) => {
                      const isSelected = row.selectedCandidateIdx === cIdx;
                      return (
                        <div
                          key={cIdx}
                          onClick={() => handleSelectCandidate(idx, cIdx)}
                          className={`flex items-center justify-between px-2 py-0.5 rounded-[2px] cursor-pointer text-[12px] ${
                            isSelected ? 'bg-[#e4effd]' : 'hover:bg-[#f0f0f0]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="text-[#111111]">{cand}</span>
                          </div>

                          <div className="flex items-center gap-1 text-black font-bold">
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                        </div>
                      );
                    })}

                    {/* Cancel Selection Row */}
                    <div
                      onClick={() => handleCancelSelection(idx)}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#0070e0] text-white font-medium cursor-pointer text-[12px]"
                    >
                      <MinusCircle className="w-3.5 h-3.5 text-red-300" />
                      <span>Cancel selection</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Toolbar matching Screenshot 3 */}
      <div className="flex items-center justify-between px-1 pt-1 pb-2 shrink-0">
        {/* Left Side: Exact Search & Fuzzy Search in signature pastel yellow buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSearchSubtitles(false)}
            disabled={isSearching || rows.length === 0}
            className="px-3 py-1 bg-gradient-to-b from-[#fffbe6] to-[#f9f0c2] hover:from-white hover:to-[#f0e6ae] active:from-[#ede19f] active:to-[#e2d58f] border border-[#d9c982] rounded-[3px] shadow-sm text-[11px] font-medium text-[#5c4a00] cursor-pointer disabled:opacity-40"
          >
            {isSearching ? 'Searching...' : 'Exact Search'}
          </button>
          <button
            onClick={() => handleSearchSubtitles(true)}
            disabled={isSearching || rows.length === 0}
            className="px-3 py-1 bg-gradient-to-b from-[#fffbe6] to-[#f9f0c2] hover:from-white hover:to-[#f0e6ae] active:from-[#ede19f] active:to-[#e2d58f] border border-[#d9c982] rounded-[3px] shadow-sm text-[11px] font-medium text-[#5c4a00] cursor-pointer disabled:opacity-40"
          >
            Fuzzy Search
          </button>
          <button
            onClick={handleLoadVideos}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#a8a8a8] rounded-[3px] shadow-sm text-[11px] font-medium text-[#333333] flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Load Videos</span>
          </button>
        </div>

        {/* Right Side: Language, Subtitle Naming group box, Download, Close */}
        <div className="flex items-center gap-2">
          <div className="border border-[#b8b8b8] rounded-[4px] px-2 py-0.5 bg-[#f6f6f6] flex flex-col relative pt-1 shadow-sm">
            <span className="text-[9px] font-medium text-[#666666] leading-none mb-0.5">
              Language
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="bg-transparent text-[11px] text-[#222222] outline-none cursor-pointer font-sans"
            >
              <option value="EN">English (EN)</option>
              <option value="DE">German (DE)</option>
              <option value="FR">French (FR)</option>
              <option value="ES">Spanish (ES)</option>
            </select>
          </div>

          <div className="border border-[#b8b8b8] rounded-[4px] px-2 py-0.5 bg-[#f6f6f6] flex flex-col relative pt-1 shadow-sm">
            <span className="text-[9px] font-medium text-[#666666] leading-none mb-0.5">
              Subtitle Naming
            </span>
            <select
              value={namingFormat}
              onChange={(e) => setNamingFormat(e.target.value)}
              className="bg-transparent text-[11px] text-[#222222] outline-none cursor-pointer"
            >
              <option value="Match Video and Language">Match Video and Language ▾</option>
              <option value="Original Subtitle Name">Original Subtitle Name ▾</option>
              <option value="Language Code Only">Language Code Only ▾</option>
            </select>
          </div>

          <button
            onClick={handleDownload}
            disabled={isDownloading || rows.filter((r) => r.matchedSubtitle).length === 0}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[11px] font-medium text-[#222222] cursor-pointer disabled:opacity-40"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
          </button>

          <button
            onClick={() => setRows([])}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[11px] font-medium text-[#222222] cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
