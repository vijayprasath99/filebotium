# Episodes Explorer & Fetcher Specification

## Section A: Legacy Codebase Analysis

### Source Files Audited
- `src/main/java/net/filebot/ui/episodelist/EpisodeListPanel.java`
- `src/main/java/net/filebot/ui/episodelist/EpisodeListPanelBuilder.java`
- `src/main/java/net/filebot/ui/episodelist/SeasonSpinnerEditor.java`
- `src/main/java/net/filebot/ui/episodelist/SeasonSpinnerModel.java`
- `src/main/java/net/filebot/ui/episodelist/EpisodeListExportHandler.java`
- `src/main/java/net/filebot/web/EpisodeListProvider.java`
- `src/main/java/net/filebot/web/AbstractEpisodeListProvider.java`
- `src/main/java/net/filebot/web/TheTVDBClient.java`
- `src/main/java/net/filebot/web/TMDbTVClient.java`
- `src/main/java/net/filebot/web/AnidbClient.java`
- `src/main/java/net/filebot/web/TVMazeClient.java`

### UI Hierarchy & Layout Mechanics
1. **Episodes Explorer Panel (`EpisodeListPanel`)**:
   - Provider Selector: Dropdown allowing selection between TheTVDB, TMDb, AniDB, and TVMaze.
   - Search Query Input: Text field for series title queries with auto-complete/history.
   - Season Selector Spinner (`SeasonSpinnerEditor`): Numeric spinner to filter by specific season or view "All Seasons".
   - Language Combobox (`LanguageComboBox`): Choice of episode language localization.
   - Episode List Table (`JTable`): Columns for Season, Episode Number, Absolute Number, Title, Release Date, and Overview.
   - Format Expression Preview bar: Formats selected episode rows according to current user format expression.
   - Export Handler (`EpisodeListExportHandler`): Drag or save episode lists as text, CSV, or formatted file lists.

### Extracted Business Logic & Data Fetching
- **Multi-Provider Fetching (`EpisodeListProvider`)**:
  - Sends query requests to metadata scraper APIs.
  - Caches fetched series structures locally (`Cache` / `CacheManager`) to minimize API rate limit usage (`FloodLimit`).
  - Supports ordering modes: Air Date Order, Absolute Order, DVD Order.

---

## Section B: Target Spring Boot Backend Specification

### Service Interfaces & DTOs

```java
package net.filebot.backend.service;

import net.filebot.backend.domain.EpisodeSortOrder;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.EpisodeDto;
import net.filebot.backend.dto.SearchResultDto;
import java.util.List;

public interface EpisodeFetcherService {
    List<SearchResultDto> searchSeries(SeriesSearchRequestDto request);
    List<EpisodeDto> getEpisodes(EpisodeFetchRequestDto request);
    List<String> getFormattedEpisodeList(EpisodeFetchRequestDto request, String formatExpression);
}

public record SeriesSearchRequestDto(
    String query,
    ProviderType provider,
    LanguageCode language
) {}

public record EpisodeFetchRequestDto(
    int seriesId,
    ProviderType provider,
    EpisodeSortOrder sortOrder,
    LanguageCode language,
    Integer seasonFilter
) {}

public record SearchResultDto(
    int id,
    String name,
    Integer year,
    ProviderType provider
) {}
```

### REST Endpoints

#### 1. Search Series Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/episodes/search`
- **Query Parameters:** `query` (string), `provider` (`THE_TVDB`, `THE_MOVIE_DB`, `ANI_DB`, `TV_MAZE`), `language` (`EN`, `DE`, `FR`, `ES`, etc.)
- **Response JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "name": { "type": "string" },
      "year": { "type": "integer" },
      "provider": { "type": "string", "enum": ["THE_TVDB", "THE_MOVIE_DB", "ANI_DB", "TV_MAZE"] }
    }
  }
}
```

#### 2. Fetch Episodes Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/episodes/series/{seriesId}`
- **Query Parameters:** `provider` (`ProviderType`), `sortOrder` (`AIR_DATE`, `ABSOLUTE`, `DVD`), `language` (`LanguageCode`), `season` (optional integer)
- **Response JSON Schema:** List of `EpisodeDto` objects.

---

## Section C: Target React Frontend Specification

### Component Architecture

```
EpisodesExplorerPanel
├── SearchAndFilterHeader (Top Bar)
│   ├── SeriesSearchInput (with TV icon placeholder)
│   ├── SeasonFilterDropdown (e.g., "All Seasons")
│   ├── SortOrderDropdown (e.g., "Airdate Order")
│   ├── LanguageSelector (e.g., "English")
│   └── FindButton (with Binoculars icon)
├── SearchResultsTabs (e.g., "History", "Series Title")
├── SeriesDisambiguationModal
├── EpisodeDataTable
│   ├── TableHeader (Season, Episode #, Title, Release Date, Absolute #)
│   ├── TableRow (Zebra-striped rows, Click to preview formatted name)
│   └── FormatPreviewFooter
└── BottomToolbar
    └── SaveAsButton (with Notepad icon)
```

### Props & State Types (TypeScript)

```typescript
import { ProviderType, EpisodeSortOrder, LanguageCode, Episode, SearchResult } from './types';

export interface EpisodesExplorerState {
  provider: ProviderType;
  searchQuery: string;
  selectedSeries: SearchResult | null;
  seasonFilter: number | 'ALL';
  language: LanguageCode;
  sortOrder: EpisodeSortOrder;
  episodes: Episode[];
  isLoading: boolean;
  formattedPreview: string[];
}
```

---

## Section D: Dialogs, Modals & Edge Cases

1. **Series Disambiguation Modal:**
   - Displays candidate series when search query returns multiple matches.
2. **Rate Limit / API Quota Warning Modal:**
   - Alerts user when provider requests fail due to HTTP 429 / rate limits.

---

## AUDIT ADDENDUM (2026-09-19) — DO NOT SILENTLY OVERWRITE ORIGINAL CONTENT ABOVE

Full detail: `specs/audit/04_episodes_audit.md`. **This is the best-wired area in the
whole application audit** — `EpisodeFetcherServiceImpl` genuinely calls the real
`TheTVDBClient`/`TMDbTVClient`/`AnidbClient`/`TVMazeClient` provider classes, unlike
the fabricated/stubbed backends found in Rename, Subtitles, and SFV. It is still
broken in production, but by narrow, cheap-to-fix bugs rather than missing
implementation:

- **EP-01 (BROKEN_FUNCTIONALITY, top priority in this document):**
  `EpisodeFetcherServiceImpl.getProvider()` constructs every provider client with
  the **literal placeholder string `"test-key"`**, never reading real keys from
  `net.filebot.WebServices`. Failed auth is silently swallowed
  (`catch(Exception e){return emptyList();}`), so every search just shows "No TV
  series found." **New requirement:** replace the manual `new XyzClient("test-key")`
  construction with `net.filebot.WebServices`'s pre-wired singletons
  (`WebServices.TheTVDB`, `WebServices.TheMovieDB`, `WebServices.AniDB`) exactly as
  `EpisodeListPanel.java:103-105`'s `WebServices.getEpisodeListProviders()` does.
  One-line-per-provider fix, not a rewrite.
- **EP-02 (BROKEN_FUNCTIONALITY):** both `searchSeries()` and `getEpisodes()`
  hardcode `Locale.ENGLISH`, ignoring the (correctly transport-wired)
  `request.language()` field entirely — non-English users always get English
  results.
- **EP-04 (BROKEN_FUNCTIONALITY):** the legacy right-click "Send to → Rename/List"
  context menu (arguably the primary reason to use this panel — browse episodes,
  then push them into the Rename matching engine) has **zero React implementation**.
  Episodes Explorer and Rename Workspace are fully isolated from each other today.
  Fix should mirror the already-working Analyze-panel "Send to" pattern
  (`AppShell.tsx`'s `onNavigateTab`/`droppedFiles` lifting).
- **§A "Format Expression Preview bar" / §C `FormatPreviewFooter` — spec
  correction, not an implementation gap:** no such feature exists anywhere in the
  legacy 314-line `EpisodeListPanel.java` source. Recommend removing this from the
  spec rather than treating its absence in React as a defect.
- Minor gaps (season-spinner keyboard shortcuts, provider season-support gating,
  autocomplete history sourced from session state instead of the bundled release-info
  index, missing year field in disambiguation results) are cataloged in the audit
  file with exact citations; none block core functionality once EP-01/EP-02/EP-04
  are fixed.
