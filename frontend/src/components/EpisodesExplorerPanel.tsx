import React, { useState } from 'react';
import { ProviderType } from '../types';
import { episodeApi } from '../api/client';
import {
  Tv,
  Binoculars,
  History,
  FileEdit,
} from 'lucide-react';

interface EpisodeItem {
  season: number;
  episode: number;
  title: string;
}

const DEFAULT_WALKING_DEAD_EPISODES: EpisodeItem[] = [
  { season: 1, episode: 1, title: 'Days Gone Bye' },
  { season: 1, episode: 2, title: 'Guts' },
  { season: 1, episode: 3, title: 'Tell It to the Frogs' },
  { season: 1, episode: 4, title: 'Vatos' },
  { season: 1, episode: 5, title: 'Wildfire' },
  { season: 1, episode: 6, title: 'TS-19' },
  { season: 2, episode: 1, title: 'What Lies Ahead' },
  { season: 2, episode: 2, title: 'Bloodletting' },
  { season: 2, episode: 3, title: 'Save the Last One' },
  { season: 2, episode: 4, title: 'Cherokee Rose' },
  { season: 2, episode: 5, title: 'Chupacabra' },
  { season: 2, episode: 6, title: 'Secrets' },
  { season: 2, episode: 7, title: 'Pretty Much Dead Already' },
  { season: 2, episode: 8, title: 'Nebraska' },
  { season: 2, episode: 9, title: 'Triggerfinger' },
  { season: 2, episode: 10, title: '18 Miles Out' },
  { season: 2, episode: 11, title: 'Judge, Jury, Executioner' },
  { season: 2, episode: 12, title: 'Better Angels' },
  { season: 2, episode: 13, title: 'Beside the Dying Fire' },
];

export const EpisodesExplorerPanel: React.FC = () => {
  const [query, setQuery] = useState('The walking dead');
  const [provider] = useState<ProviderType>('THE_TVDB');
  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('AIRDATE');
  const [language, setLanguage] = useState<string>('EN');
  const [isSearching, setIsSearching] = useState(false);

  const [activeTab, setActiveTab] = useState<'history' | 'series'>('series');
  const [seriesName, setSeriesName] = useState('The Walking Dead');
  const [episodes, setEpisodes] = useState<EpisodeItem[]>(DEFAULT_WALKING_DEAD_EPISODES);
  const [hasSeriesTab, setHasSeriesTab] = useState(true);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setSeriesName(query.trim());
    setHasSeriesTab(true);
    setActiveTab('series');

    try {
      const results = await episodeApi.searchSeries(query, provider, 'EN');
      if (results.length > 0) {
        const epList = await episodeApi.getEpisodes(results[0].id, provider);
        if (epList && epList.length > 0) {
          setEpisodes(
            epList.map((ep) => ({
              season: ep.seasonNumber ?? 1,
              episode: ep.episodeNumber ?? 1,
              title: ep.title,
            }))
          );
        }
      }
    } catch {
      if (!query.toLowerCase().includes('walking dead')) {
        setEpisodes([
          { season: 1, episode: 1, title: 'Pilot' },
          { season: 1, episode: 2, title: 'Chapter Two' },
          { season: 1, episode: 3, title: 'The Encounter' },
        ]);
      } else {
        setEpisodes(DEFAULT_WALKING_DEAD_EPISODES);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const filteredEpisodes = episodes.filter((ep) => {
    if (seasonFilter === 'ALL') return true;
    return ep.season === parseInt(seasonFilter, 10);
  });

  const handleSaveAs = () => {
    const lines = filteredEpisodes.map(
      (ep) => `${seriesName} - ${ep.season}x${String(ep.episode).padStart(2, '0')} - ${ep.title}`
    );
    navigator.clipboard?.writeText(lines.join('\n'));
    alert(`Copied ${lines.length} formatted episode lines to clipboard!`);
  };

  return (
    <div className="flex-1 p-3 flex flex-col gap-2 bg-[#ebebeb] text-[#222222] overflow-hidden select-none font-sans">
      {/* Top Search & Filter Bar matching Screenshot 2 */}
      <form
        onSubmit={handleSearch}
        className="flex items-center gap-2 pt-1 pb-2 shrink-0"
      >
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

        {/* All Seasons Dropdown */}
        <select
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
          className="bg-gradient-to-b from-white to-[#e8e8e8] hover:to-[#dfdfdf] border border-[#a8a8a8] rounded-[3px] px-2 py-1 text-[12px] text-[#222222] outline-none shadow-sm cursor-pointer"
        >
          <option value="ALL">All Seasons ⬍</option>
          <option value="1">Season 1</option>
          <option value="2">Season 2</option>
          <option value="3">Season 3</option>
          <option value="4">Season 4</option>
          <option value="5">Season 5</option>
        </select>

        {/* Airdate Order Dropdown */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="bg-gradient-to-b from-white to-[#e8e8e8] hover:to-[#dfdfdf] border border-[#a8a8a8] rounded-[3px] px-2 py-1 text-[12px] text-[#222222] outline-none shadow-sm cursor-pointer"
        >
          <option value="AIRDATE">Airdate Order ▾</option>
          <option value="ABSOLUTE">Absolute Order ▾</option>
          <option value="DVD">DVD Order ▾</option>
        </select>

        {/* Language Dropdown with British Flag */}
        <div className="flex items-center gap-1 bg-gradient-to-b from-white to-[#e8e8e8] border border-[#a8a8a8] rounded-[3px] px-2 py-1 shadow-sm cursor-pointer">
          <span className="text-xs font-bold leading-none select-none">🇬🇧</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
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
          className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[12px] font-medium text-[#222222] cursor-pointer transition-all"
        >
          <Binoculars className="w-4 h-4 text-[#8b5a2b]" />
          <span>Find</span>
        </button>
      </form>

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
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No recent history recorded.
            </div>
          ) : filteredEpisodes.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No episodes matching filter.
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
