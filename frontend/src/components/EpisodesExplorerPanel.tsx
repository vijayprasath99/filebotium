import React, { useState } from 'react';
import { ProviderType, Episode } from '../types';
import { episodeApi } from '../api/client';
import { Search, Tv } from 'lucide-react';

export const EpisodesExplorerPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<ProviderType>('THE_TVDB');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const results = await episodeApi.searchSeries(query, provider, 'EN');
      if (results.length > 0) {
        const epList = await episodeApi.getEpisodes(results[0].id, provider);
        setEpisodes(epList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-950 text-slate-100 overflow-hidden">
      <form onSubmit={handleSearch} className="flex items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderType)}
          className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 outline-none"
        >
          <option value="THE_TVDB">TheTVDB</option>
          <option value="THE_MOVIE_DB">TheMovieDB</option>
          <option value="ANI_DB">AniDB</option>
          <option value="TV_MAZE">TVMaze</option>
        </select>

        <div className="flex-1 flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search series title (e.g. The Office, Breaking Bad)..."
            className="w-full bg-transparent text-xs text-slate-200 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSearching}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Tv className="w-4 h-4" />
          {isSearching ? 'Fetching...' : 'Fetch Episodes'}
        </button>
      </form>

      <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <th className="p-3 w-16 text-center">Season</th>
              <th className="p-3 w-16 text-center">Ep #</th>
              <th className="p-3 w-24 text-center">Absolute</th>
              <th className="p-3">Episode Title</th>
              <th className="p-3 w-28 text-center">Release Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Search for a TV series above to explore and export episode lists.
                </td>
              </tr>
            ) : (
              episodes.map((ep, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 text-center font-mono text-slate-400">{ep.seasonNumber ?? '-'}</td>
                  <td className="p-3 text-center font-mono text-slate-300 font-bold">{ep.episodeNumber ?? '-'}</td>
                  <td className="p-3 text-center font-mono text-slate-500">{ep.absoluteNumber ?? '-'}</td>
                  <td className="p-3 font-medium text-slate-200">{ep.title}</td>
                  <td className="p-3 text-center text-slate-400 font-mono">{ep.releaseDate ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
