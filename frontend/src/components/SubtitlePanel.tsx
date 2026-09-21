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
  Eye,
  Save,
  X,
} from 'lucide-react';
import { SubtitleDescriptor, LanguageCode } from '../types';
import { subtitleApi, appApi } from '../api/client';
import { getFilePaths } from '../utils/fileUtils';

interface SubtitleRow {
  video: string;
  matchedSubtitle: string | null;
  candidates?: string[];
  expanded?: boolean;
  selectedCandidateIdx?: number;
  descriptor?: SubtitleDescriptor;
  downloadedPath?: string;
}

interface SubtitlePanelProps {
  files?: string[];
}

export const SubtitlePanel: React.FC<SubtitlePanelProps> = ({ files }) => {
  const [rows, setRows] = useState<SubtitleRow[]>([]);
  const [language, setLanguage] = useState<LanguageCode>('EN');
  const [namingFormat, setNamingFormat] = useState<
    'ORIGINAL' | 'MATCH_VIDEO' | 'MATCH_VIDEO_ADD_LANGUAGE_TAG'
  >('MATCH_VIDEO_ADD_LANGUAGE_TAG');
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind: 'info' | 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: SubtitleRow } | null>(null);
  const [previewContent, setPreviewContent] = useState<{ path: string; text: string } | null>(null);

  const handleRowContextMenu = (e: React.MouseEvent, row: SubtitleRow) => {
    if (!row.downloadedPath) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, row });
  };

  const handlePreview = async () => {
    const path = contextMenu?.row.downloadedPath;
    setContextMenu(null);
    if (!path) return;
    try {
      const text = await subtitleApi.readContent(path);
      setPreviewContent({ path, text: text || '(empty file)' });
    } catch {
      showStatus('Failed to read subtitle file.', 'error');
    }
  };

  const handleSaveAs = async () => {
    const path = contextMenu?.row.downloadedPath;
    setContextMenu(null);
    if (!path) return;
    try {
      const text = await subtitleApi.readContent(path);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split(/[/\\]/).pop() || 'subtitle.srt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showStatus('Failed to export subtitle file.', 'error');
    }
  };

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
        const pathsToAdd =
          ingested?.acceptedFiles?.length > 0 ? ingested.acceptedFiles.map((f) => f.path) : rawPaths;
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
      const results = await subtitleApi.searchSubtitles(
        videoPaths,
        language,
        'OPEN_SUBTITLES',
        isFuzzy ? 'FUZZY' : 'EXACT'
      );
      const resultsByVideo = new Map<string, SubtitleDescriptor[]>();
      results.forEach((r) => {
        const list = resultsByVideo.get(r.videoFilePath) ?? [];
        list.push(r);
        resultsByVideo.set(r.videoFilePath, list);
      });

      setRows((prev) =>
        prev.map((row) => {
          const candidates = resultsByVideo.get(row.video);
          if (candidates && candidates.length > 0) {
            const best = candidates[0];
            return {
              ...row,
              matchedSubtitle: best.name,
              candidates: candidates.map((c) => c.name),
              descriptor: best,
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
        provider: r.descriptor?.provider ?? ('OPEN_SUBTITLES' as const),
        targetFormat: 'SRT' as const,
        namingStrategy: namingFormat,
      }));
      const res = await subtitleApi.downloadSubtitles(requests);
      showStatus(
        `Downloaded ${res.successCount} subtitle(s). Saved: ${res.downloadedSubtitlePaths.join(', ')}`,
        'success'
      );

      // downloadedSubtitlePaths only lists successful downloads, in request order - only safe
      // to zip 1:1 back onto rows when every request in this batch succeeded.
      if (res.successCount === matchedRows.length) {
        const pathByVideo = new Map(matchedRows.map((r, i) => [r.video, res.downloadedSubtitlePaths[i]]));
        setRows((prev) =>
          prev.map((row) =>
            pathByVideo.has(row.video) ? { ...row, downloadedPath: pathByVideo.get(row.video) } : row
          )
        );
      }
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
                  <div
                    onContextMenu={(e) => handleRowContextMenu(e, row)}
                    className="flex items-center justify-between pl-3 border-l border-[#f0f0f0] min-w-0"
                  >
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
              <option value="IT">Italian (IT)</option>
              <option value="JA">Japanese (JA)</option>
              <option value="ZH">Chinese (ZH)</option>
              <option value="KO">Korean (KO)</option>
              <option value="RU">Russian (RU)</option>
              <option value="PT">Portuguese (PT)</option>
              <option value="NL">Dutch (NL)</option>
              <option value="SV">Swedish (SV)</option>
              <option value="NO">Norwegian (NO)</option>
              <option value="DA">Danish (DA)</option>
              <option value="FI">Finnish (FI)</option>
              <option value="PL">Polish (PL)</option>
            </select>
          </div>

          <div className="border border-[#b8b8b8] rounded-[4px] px-2 py-0.5 bg-[#f6f6f6] flex flex-col relative pt-1 shadow-sm">
            <span className="text-[9px] font-medium text-[#666666] leading-none mb-0.5">
              Subtitle Naming
            </span>
            <select
              value={namingFormat}
              onChange={(e) => setNamingFormat(e.target.value as typeof namingFormat)}
              className="bg-transparent text-[11px] text-[#222222] outline-none cursor-pointer"
            >
              <option value="MATCH_VIDEO_ADD_LANGUAGE_TAG">Match Video and Language ▾</option>
              <option value="ORIGINAL">Original Subtitle Name ▾</option>
              <option value="MATCH_VIDEO">Match Video ▾</option>
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

      {/* Downloaded Subtitle Context Menu (G8: Preview / Save As) */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-white border border-[#b8b8b8] rounded-[4px] shadow-lg py-1 w-40 text-[12px] font-sans text-[#222222]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={handlePreview}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#eaf2fc] text-left"
            >
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              Preview
            </button>
            <button
              onClick={handleSaveAs}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#eaf2fc] text-left"
            >
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              Save As / Export
            </button>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[80vh] bg-white border border-slate-300 rounded-lg shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-300 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-700 truncate" title={previewContent.path}>
                {previewContent.path.split(/[/\\]/).pop()}
              </span>
              <button onClick={() => setPreviewContent(null)} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-slate-800">
              {previewContent.text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
