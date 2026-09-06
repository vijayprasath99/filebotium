import React, { useState } from 'react';
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
} from 'lucide-react';

interface SubtitleRow {
  video: string;
  matchedSubtitle: string | null;
  candidates?: string[];
  expanded?: boolean;
  selectedCandidateIdx?: number;
}

const INITIAL_SUBTITLE_ROWS: SubtitleRow[] = [
  {
    video: 'A.I. Artificial Intelligence (2001).mp4',
    matchedSubtitle: 'Artificial Intelligence 2001 720p BDRip x264 YIFY eng.srt',
  },
  {
    video: 'A History of Violence (2005).mp4',
    matchedSubtitle: 'A.History.Of.Violence.2005.1080p.BluRay.x264-CiNEFiLE.eng.srt',
  },
  {
    video: 'All That Jazz (1979).mkv',
    matchedSubtitle: 'All That Jazz .eng.srt',
    candidates: [
      'All That Jazz .eng.srt',
      'All That Jazz es.eng.srt',
    ],
    expanded: true,
    selectedCandidateIdx: 1,
  },
  {
    video: 'Gummo (1997).avi',
    matchedSubtitle: null,
  },
  {
    video: 'Happy End (2017).mkv',
    matchedSubtitle: 'Happy End 2017 1080p BluRay x264 DTS-HD.eng.srt',
  },
  {
    video: 'Dude Game - The Movie (2012).mp4',
    matchedSubtitle: 'Dude Game The Movie (2012) WEBRip x264.eng.srt',
  },
  {
    video: 'Lawrence of Arabia (1962).mkv',
    matchedSubtitle: 'Lawrence of Arabia (1962) CD1.eng.srt',
  },
  {
    video: 'Once Upon a Time in Anatolia (2011).mkv',
    matchedSubtitle: 'Once.Upon.A.Time.In.Anatolia.2011.720p.BluRay.x264-CiNEFiLE.english.eng.srt',
  },
  {
    video: 'Rust and Bone (2012).mkv',
    matchedSubtitle: 'De.Rouille.et.Dos-[Rust.and.Bone].2012.FRENCH.720p.BluRay.x264-NiCE.srt',
  },
  {
    video: 'Samsara (2011).avi',
    matchedSubtitle: 'Samsara 2011 BRRip XviD AC3 - HDScene.eng.srt',
  },
  {
    video: 'Shameless (2012).avi',
    matchedSubtitle: null,
  },
  {
    video: 'Silent Light (2007).mp4',
    matchedSubtitle: 'Silent Light (2007) DVDRIP ENG.eng.srt',
  },
  {
    video: 'The Fantastic Adventures of Unico (1981).avi',
    matchedSubtitle: 'The Fantastic Adventures Of Unico English subtitles eng.srt',
  },
  {
    video: 'The Last King of Scotland (2006).mkv',
    matchedSubtitle: 'The Last King of Scotland 2006 Bluray english.eng.srt',
  },
];

export const SubtitlePanel: React.FC = () => {
  const [rows, setRows] = useState<SubtitleRow[]>(INITIAL_SUBTITLE_ROWS);
  const [namingFormat, setNamingFormat] = useState('Match Video and Language');
  const [isSearching, setIsSearching] = useState(false);

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

  return (
    <div className="flex-1 p-2 flex flex-col gap-2 bg-[#ebebeb] text-[#222222] overflow-hidden select-none font-sans">
      {/* Table Container matching Screenshot 3 */}
      <div className="flex-1 flex flex-col min-h-0 bg-white border border-[#a8a8a8] rounded-[2px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-2 bg-[#f4f4f4] border-b border-[#c8c8c8] px-3 py-1 text-[11px] font-normal text-[#555555]">
          <div>Video</div>
          <div className="pl-3 border-l border-[#d8d8d8]">Subtitle</div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#ececec] text-[12px] font-sans">
          {rows.map((row, idx) => (
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
                      No subtitles found
                    </span>
                  )}

                  {row.candidates && row.candidates.length > 0 && (
                    <button
                      onClick={() => toggleRowExpanded(idx)}
                      className="p-0.5 text-[#555555] hover:text-black ml-2 transition-colors"
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

              {/* Expanded Sub-Rows for Candidate List (matching All That Jazz in Screenshot 3) */}
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

                        {cIdx === 1 && (
                          <div className="flex items-center gap-1 text-black font-bold">
                            <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Cancel Selection Row (solid royal blue in Screenshot 3) */}
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
          ))}
        </div>
      </div>

      {/* Bottom Toolbar matching Screenshot 3 */}
      <div className="flex items-center justify-between px-1 pt-1 pb-2 shrink-0">
        {/* Left Side: Exact Search & Fuzzy Search in signature pastel yellow buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Exact Search')}
            disabled={isSearching}
            className="px-3 py-1 bg-gradient-to-b from-[#fffbe6] to-[#f9f0c2] hover:from-white hover:to-[#f0e6ae] active:from-[#ede19f] active:to-[#e2d58f] border border-[#d9c982] rounded-[3px] shadow-sm text-[11px] font-medium text-[#5c4a00] cursor-pointer"
          >
            Exact Search
          </button>
          <button
            onClick={() => alert('Fuzzy Search')}
            disabled={isSearching}
            className="px-3 py-1 bg-gradient-to-b from-[#fffbe6] to-[#f9f0c2] hover:from-white hover:to-[#f0e6ae] active:from-[#ede19f] active:to-[#e2d58f] border border-[#d9c982] rounded-[3px] shadow-sm text-[11px] font-medium text-[#5c4a00] cursor-pointer"
          >
            Fuzzy Search
          </button>
        </div>

        {/* Right Side: Subtitle Naming group box, Download, Close */}
        <div className="flex items-center gap-3">
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
            onClick={() => alert('Subtitles downloaded successfully!')}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[11px] font-medium text-[#222222] cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download</span>
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
