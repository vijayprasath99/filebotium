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
├── SearchAndFilterHeader
│   ├── ProviderSelector (TheTVDB, TMDb, AniDB, TVMaze)
│   ├── SeriesSearchInput
│   ├── SeasonFilterDropdown
│   └── LanguageSelector
├── SeriesDisambiguationModal
└── EpisodeDataTable
    ├── TableHeader (Season, Episode #, Title, Release Date, Absolute #)
    ├── TableRow (Click to preview formatted name)
    └── FormatPreviewFooter
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
