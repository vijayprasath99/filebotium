import React, { useState, useEffect } from 'react';
import { ProviderType, SearchResult, EpisodeSortOrder, LanguageCode } from '../types';
import { episodeApi } from '../api/client';
import {
  Tv,
  Binoculars,
  History,
  FileEdit,
  Download,
  ListFilter,
} from 'lucide-react';

interface EpisodeItem {
  season: number;
  episode: number;
  title: string;
}

export const EpisodesExplorerPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<ProviderType>('THE_TVDB');
  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<EpisodeSortOrder>('AIR_DATE');
  const [language, setLanguage] = useState<LanguageCode>('EN');
  const [isSearching, setIsSearching] = useState(false);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind: 'info' | 'success' | 'error' } | null>(null);

  const showStatus = (text: string, kind: 'info' | 'success' | 'error' = 'info') => {
    setStatusMsg({ text, kind });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const [activeTab, setActiveTab] = useState<'history' | 'series'>('history');
  const [seriesName, setSeriesName] = useState('');
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [hasSeriesTab, setHasSeriesTab] = useState(false);

  const fetchEpisodesForSeries = async (
    seriesId: number,
    seriesTitle: string,
    currentProvider: ProviderType = provider,
    order: EpisodeSortOrder = sortOrder,
    lang: LanguageCode = language
  ) => {
    setIsSearching(true);
    try {
      const epList = await episodeApi.getEpisodes(seriesId, currentProvider, order, lang);
      if (epList && epList.length > 0) {
        setEpisodes(
          epList.map((ep) => ({
            season: ep.seasonNumber ?? 1,
            episode: ep.episodeNumber ?? 1,
            title: ep.title,
          }))
        );
      } else {
        setEpisodes([]);
      }
      setSeriesName(seriesTitle);
      setSelectedSeriesId(seriesId);
      setHasSeriesTab(true);
      setActiveTab('series');
    } catch (err) {
      console.error('Failed to fetch episodes:', err);
      setEpisodes([]);
      showStatus('Unable to retrieve series episode information from the server.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);

    try {
      const results = await episodeApi.searchSeries(query.trim(), provider, language);
      setSearchResults(results);
      if (!searchHistory.includes(query.trim())) {
        setSearchHistory((prev) => [query.trim(), ...prev.slice(0, 9)]);
      }

      if (results && results.length > 0) {
        // Automatically fetch the first candidate, but user can change via dropdown
        await fetchEpisodesForSeries(results[0].id, results[0].name, provider, sortOrder, language);
      } else {
        setEpisodes([]);
        showStatus(`No TV series found matching "${query.trim()}".`, 'info');
      }
    } catch (err) {
      console.error('Failed to search episodes:', err);
      setEpisodes([]);
      showStatus('Unable to search series on the server.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSeriesCandidate = (seriesId: number) => {
    const candidate = searchResults.find((r) => r.id === seriesId);
    if (candidate) {
      fetchEpisodesForSeries(candidate.id, candidate.name, provider, sortOrder, language);
    }
  };

  const handleSortOrderChange = (newOrder: EpisodeSortOrder) => {
    setSortOrder(newOrder);
    if (selectedSeriesId) {
      fetchEpisodesForSeries(selectedSeriesId, seriesName, provider, newOrder, language);
    }
  };

  // Distinct seasons dynamically calculated from fetched episode list
  const availableSeasons = Array.from(new Set(episodes.map((ep) => ep.season))).sort((a, b) => a - b);

  const filteredEpisodes = episodes.filter((ep) => {
    if (seasonFilter === 'ALL') return true;
    return ep.season === parseInt(seasonFilter, 10);
  });

  const handleSaveAs = () => {
    if (filteredEpisodes.length === 0) return;
    const lines = filteredEpisodes.map(
      (ep) => `${seriesName} - ${ep.season}x${String(ep.episode).padStart(2, '0')} - ${ep.title}`
    );
    const content = lines.join('\n');
    navigator.clipboard?.writeText(content);

    // Also download as a txt file
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seriesName || 'Episodes'}-List.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showStatus(`Saved ${lines.length} episodes to "${seriesName || 'Episodes'}-List.txt" and copied to clipboard!`, 'success');
  };

  return (
    <div className="flex-1 p-3 flex flex-col gap-2 bg-[#ebebeb] text-[#222222] overflow-hidden select-none font-sans">
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
      {/* Top Search & Filter Bar matching Screenshot 2 */}
      <form
        onSubmit={handleSearch}
        className="flex items-center gap-2 pt-1 pb-1 shrink-0"
      >
        {/* Provider Selector */}
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderType)}
          className="bg-gradient-to-b from-white to-[#e8e8e8] hover:to-[#dfdfdf] border border-[#a8a8a8] rounded-[3px] px-2 py-1 text-[11px] text-[#222222] outline-none shadow-sm cursor-pointer"
          title="Metadata Provider"
        >
          <option value="THE_TVDB">TheTVDB</option>
          <option value="THE_MOVIE_DB">TheMovieDB</option>
          <option value="ANI_DB">AniDB</option>
          <option value="TV_MAZE">TVmaze</option>
        </select>

        {/* Search Input with TV icon */}
        <div className="flex-1 flex items-center gap-1.5 bg-white px-2 py-1 rounded-[3px] border border-[#a8a8a8] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)]">
          <Tv className="w-3.5 h-3.5 text-[#555555] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search TV series..."
            className="w-full bg-transparent text-[12px] text-[#111111] outline-none"
          />
        </div>

        {/* Dynamic Seasons Dropdown */}
        <select
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
          className="bg-gradient-to-b from-white to-[#e8e8e8] hover:to-[#dfdfdf] border border-[#a8a8a8] rounded-[3px] px-2 py-1 text-[12px] text-[#222222] outline-none shadow-sm cursor-pointer"
        >
          <option value="ALL">All Seasons ⬍</option>
          {availableSeasons.map((s) => (
            <option key={s} value={String(s)}>
              Season {s}
            </option>
          ))}
        </select>

        {/* Sort Order Dropdown */}
        <select
          value={sortOrder}
          onChange={(e) => handleSortOrderChange(e.target.value as EpisodeSortOrder)}
          className="bg-gradient-to-b from-white to-[#e8e8e8] hover:to-[#dfdfdf] border border-[#a8a8a8] rounded-[3px] px-2 py-1 text-[12px] text-[#222222] outline-none shadow-sm cursor-pointer"
        >
          <option value="AIR_DATE">Airdate Order ▾</option>
          <option value="ABSOLUTE">Absolute Order ▾</option>
          <option value="DVD">DVD Order ▾</option>
        </select>

        {/* Language Dropdown */}
        <div className="flex items-center gap-1 bg-gradient-to-b from-white to-[#e8e8e8] border border-[#a8a8a8] rounded-[3px] px-2 py-1 shadow-sm cursor-pointer">
          <span className="text-xs font-bold leading-none select-none">🇬🇧</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="bg-transparent text-[12px] text-[#222222] outline-none cursor-pointer"
          >
            <option value="EN">English ▾</option>
            <option value="DE">German ▾</option>
            <option value="FR">French ▾</option>
            <option value="ES">Spanish ▾</option>
          </select>
        </div>

        {/* Find Button with Binoculars Icon */}
        <button
          type="submit"
          disabled={isSearching}
          className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[12px] font-medium text-[#222222] cursor-pointer transition-all disabled:opacity-40"
        >
          <Binoculars className="w-4 h-4 text-[#8b5a2b]" />
          <span>Find</span>
        </button>
      </form>

      {/* Series Disambiguation Dropdown Bar (shown when multiple results returned) */}
      {searchResults.length > 1 && (
        <div className="flex items-center gap-2 px-2 py-1 bg-amber-50 border border-amber-300 rounded-[3px] text-[11px] shrink-0">
          <ListFilter className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span className="text-amber-800 font-medium">Multiple shows matched:</span>
          <select
            value={selectedSeriesId ?? searchResults[0].id}
            onChange={(e) => handleSelectSeriesCandidate(Number(e.target.value))}
            className="bg-white border border-amber-400 rounded px-2 py-0.5 text-[#222222] outline-none cursor-pointer font-medium"
          >
            {searchResults.map((res) => (
              <option key={res.id} value={res.id}>
                {res.name} {res.year ? `(${res.year})` : ''} [{res.provider}]
              </option>
            ))}
          </select>
          <span className="text-amber-600 text-[10px]">
            ({searchResults.length} results found)
          </span>
        </div>
      )}

      {/* Search Results Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Results Header Label */}
        <div className="px-1 pb-1">
          <span className="text-[12px] font-normal text-[#555555]">Search Results</span>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-end gap-1 px-1 shrink-0">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-t-[4px] text-[11px] font-medium border-t border-x transition-colors ${
              activeTab === 'history'
                ? 'bg-white text-[#222222] border-[#a8a8a8] border-b-white relative z-10'
                : 'bg-[#dedede] text-[#666666] border-[#bcbcbc] hover:bg-[#e8e8e8]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#555555]" />
            <span>History</span>
          </button>

          {hasSeriesTab && (
            <div
              onClick={() => setActiveTab('series')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-t-[4px] text-[11px] font-medium border-t border-x cursor-pointer transition-colors ${
                activeTab === 'series'
                  ? 'bg-white text-[#222222] border-[#a8a8a8] border-b-white relative z-10'
                  : 'bg-[#dedede] text-[#666666] border-[#bcbcbc] hover:bg-[#e8e8e8]'
              }`}
            >
              <Tv className="w-3.5 h-3.5 text-[#555555]" />
              <span>{seriesName}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setHasSeriesTab(false);
                  setActiveTab('history');
                }}
                className="ml-1 text-[#e67e22] hover:text-[#d35400] text-[12px] font-bold"
                title="Close Tab"
              >
                ☒
              </button>
            </div>
          )}
        </div>

        {/* Episode Data Table with Authentic Zebra Striping */}
        <div className="flex-1 overflow-y-auto bg-white border border-[#a8a8a8] rounded-[2px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] -mt-[1px]">
          {activeTab === 'history' ? (
            searchHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No recent history recorded. Search for a TV series above to explore episodes.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                <div className="text-[11px] font-semibold text-[#666666] px-2 py-1">Recent Searches:</div>
                {searchHistory.map((item, hi) => (
                  <div
                    key={hi}
                    onClick={() => {
                      setQuery(item);
                      // Auto-submit search for this history entry
                      setIsSearching(true);
                      episodeApi
                        .searchSeries(item, provider, language)
                        .then(async (results) => {
                          setSearchResults(results);
                          if (results && results.length > 0) {
                            await fetchEpisodesForSeries(results[0].id, results[0].name, provider, sortOrder, language);
                          } else {
                            showStatus(`No TV series found matching "${item}".`, 'info');
                          }
                        })
                        .catch(() => showStatus('Unable to search series on the server.', 'error'))
                        .finally(() => setIsSearching(false));
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-[#eaf2fc] cursor-pointer text-[12px] text-[#333333]"
                  >
                    <History className="w-3.5 h-3.5 text-[#777777]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )
          ) : filteredEpisodes.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              {isSearching ? 'Searching episodes...' : 'No episodes found.'}
            </div>
          ) : (
            <div>
              {filteredEpisodes.map((ep, idx) => {
                const epFormatted = `${seriesName} - ${ep.season}x${String(ep.episode).padStart(2, '0')} - ${ep.title}`;
                const isEven = idx % 2 === 0;
                return (
                  <div
                    key={idx}
                    className={`px-3 py-1 text-[12px] font-sans truncate cursor-pointer hover:bg-[#d8e8f8] ${
                      isEven ? 'bg-white text-[#111111]' : 'bg-[#eef5fd] text-[#111111]'
                    }`}
                  >
                    {epFormatted}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Toolbar: Centered "Save as ..." button */}
        <div className="pt-2 pb-1 flex items-center justify-center">
          <button
            onClick={handleSaveAs}
            className="flex items-center gap-1.5 px-4 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[12px] font-medium text-[#222222] cursor-pointer transition-all"
          >
            <FileEdit className="w-4 h-4 text-[#8b5a2b]" />
            <span>Save as ...</span>
          </button>
        </div>
      </div>
    </div>
  );
};
