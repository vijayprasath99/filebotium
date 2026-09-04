import React, { useState } from 'react';
import { SubtitleDescriptor } from '../types';
import { subtitleApi } from '../api/client';
import { Subtitles, Download, Search } from 'lucide-react';

export const SubtitlePanel: React.FC = () => {
  const [subtitles, setSubtitles] = useState<SubtitleDescriptor[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchSubtitles = async () => {
    setIsSearching(true);
    try {
      const results = await subtitleApi.searchSubtitles(['sample.mkv'], 'EN');
      setSubtitles(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-950 text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Subtitles className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">Subtitle Downloader & Auto-Matcher</span>
        </div>

        <button
          onClick={handleSearchSubtitles}
          disabled={isSearching}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
          {isSearching ? 'Searching...' : 'Find Subtitles'}
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <th className="p-3">Provider</th>
              <th className="p-3">Subtitle Name</th>
              <th className="p-3 w-20 text-center">Lang</th>
              <th className="p-3 w-20 text-center">Format</th>
              <th className="p-3 w-24 text-center">Score</th>
              <th className="p-3 w-24 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {subtitles.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No subtitles searched yet. Click "Find Subtitles" above.
                </td>
              </tr>
            ) : (
              subtitles.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 text-slate-400 font-semibold">{sub.provider}</td>
                  <td className="p-3 font-mono text-slate-200">{sub.name}</td>
                  <td className="p-3 text-center text-slate-300 font-bold">{sub.language}</td>
                  <td className="p-3 text-center text-slate-400 uppercase">{sub.format}</td>
                  <td className="p-3 text-center text-emerald-400 font-bold">{Math.round(sub.score * 100)}%</td>
                  <td className="p-3 text-center">
                    <button className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-[11px] transition-colors">
                      <Download className="w-3 h-3" />
                      Get
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
