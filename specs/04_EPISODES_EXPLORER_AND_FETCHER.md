# Episodes Explorer & Fetcher Specification

**Status:** As-built. This document describes `EpisodesExplorerPanel.tsx` and its backend
(`EpisodeController` / `EpisodeFetcherService`) exactly as implemented. Unlike Rename, SFV, and
Subtitles, this area's backend was never a stub — `EpisodeFetcherServiceImpl` has always called
real `net.filebot.web.*` provider clients. It shipped with two narrow bugs (a placeholder API
key and a hardcoded locale) that made real calls fail silently; both are fixed. Read
`specs/00_SYSTEM_ARCHITECTURE_AND_MODELS.md` first for the shared domain enums/DTOs and the
synchronous-REST/WebSocket-progress model referenced below.

---

## 1. UI Overview (`frontend/src/components/EpisodesExplorerPanel.tsx`)

Single-panel workspace, no dedicated toolbar component — everything lives in one file.

- **Search bar:** provider `<select>` (TheTVDB / TheMovieDB / AniDB / TVmaze), a text input
  with a submit-on-Enter `<form>`, a season `<select>` (populated from the currently fetched
  episode list, not the provider — see §4), a sort-order `<select>` (Airdate / Absolute / DVD),
  a language `<select>` (EN/DE/FR/ES only — narrower than the 16-value `LanguageCode` enum),
  and a "Find" submit button.
- **Disambiguation bar:** appears only when `searchSeries` returns more than one result;  a
  `<select>` lists every candidate as `"{name} ({year}) [{provider}]"` and switching it
  re-fetches episodes for the newly selected series ID. `res.year` is always rendered as empty
  here — see §6.
- **Results area:** two tabs, "History" (session search history) and a dynamically-added tab
  named after the currently loaded series (closable via a `☒` button that also clears
  `hasSeriesTab` and falls back to the History tab). The episode table itself has no header
  row or columns — each row is a single pre-formatted string
  `"{seriesName} - {season}x{episode:02} - {title}"`, zebra-striped by array index.
- **Right-click context menu** on an episode row: single item "Send to Rename" (see §5).
- **Bottom toolbar:** a single "Save as..." button (see §5).

State is entirely local to this component — there is no shared "current series" state with
any other panel.

---

## 2. REST Contract (`EpisodeController`, base path `/api/v1/episodes`)

```java
@GetMapping("/search")
List<SearchResultDto> searchSeries(
    @RequestParam("query") String query,
    @RequestParam(value = "provider", defaultValue = "THE_TVDB") ProviderType provider,
    @RequestParam(value = "language", defaultValue = "EN") LanguageCode language);

@GetMapping("/series/{seriesId}")
List<EpisodeDto> getEpisodes(
    @PathVariable("seriesId") int seriesId,
    @RequestParam(value = "provider", defaultValue = "THE_TVDB") ProviderType provider,
    @RequestParam(value = "sortOrder", required = false) EpisodeSortOrder sortOrder,
    @RequestParam(value = "language", defaultValue = "EN") LanguageCode language,
    @RequestParam(value = "season", required = false) Integer season);

@GetMapping("/series/{seriesId}/format")
List<String> getFormattedEpisodeList(
    @PathVariable("seriesId") int seriesId, @RequestParam("expression") String formatExpression);
```

DTOs (`net.filebot.backend.dto`):

```java
public record SeriesSearchRequestDto(String query, ProviderType provider, LanguageCode language) {}
public record SearchResultDto(int id, String name, Integer year, ProviderType provider) {}
public record EpisodeFetchRequestDto(
    int seriesId, ProviderType provider, EpisodeSortOrder sortOrder,
    LanguageCode language, Integer seasonFilter) {}
public record EpisodeDto(
    ProviderType provider, String seriesName, Integer seriesId, Integer seasonNumber,
    Integer episodeNumber, Integer absoluteNumber, String title, LocalDate releaseDate,
    LanguageCode language, String overview) {}
```

`getFormattedEpisodeList`'s controller method is itself a stub-shaped wrapper: it always
constructs a fresh `EpisodeFetchRequestDto` with `provider=THE_TVDB`, `sortOrder=null`,
`language=EN`, ignoring whatever provider/language the client actually searched with. Nothing
in the frontend currently calls this endpoint (there is no format-preview feature in the UI —
see §6), so this mismatch has no observable effect today, but do not assume this endpoint
respects the caller's original provider/language selection if you wire a caller to it.

---

## 3. Backend Implementation (`EpisodeFetcherServiceImpl`)

```java
private EpisodeListProvider getProvider(ProviderType type) {
  if (type == null) return WebServices.TheTVDB;
  return switch (type) {
    case THE_MOVIE_DB -> WebServices.TheMovieDB_TV;
    case ANI_DB -> WebServices.AniDB;
    case TV_MAZE -> WebServices.TVmaze;
    default -> WebServices.TheTVDB;
  };
}

private Locale resolveLocale(LanguageCode language) {
  if (language == null) return Locale.ENGLISH;
  Language resolved = Language.getLanguage(language.name());
  return resolved != null ? resolved.getLocale() : Locale.ENGLISH;
}
```

- `getProvider` resolves the **real, pre-wired** `net.filebot.WebServices` singletons
  (`TheTVDB` = `TheTVDBClientWithLocalSearch` constructed with a real API key from
  `Settings.getApiKey("thetvdb")`; `AniDB` = `AnidbClientWithLocalSearch` version `7`;
  `TheMovieDB_TV` wraps the real `TMDbClient`). Previously this method constructed brand-new
  clients inline with the literal string `"test-key"` (e.g. `new TheTVDBClient("test-key")`),
  which every real provider rejects — every search/fetch silently returned an empty list via
  the blanket `catch (Exception e) { return emptyList(); }` below. That placeholder is gone;
  the method now returns the same singletons `WebServices.getEpisodeListProviders()` exposes.
- `resolveLocale` derives a real `java.util.Locale` from the request's `LanguageCode` via
  `net.filebot.Language.getLanguage(code).getLocale()`, mirroring legacy's
  `Language.getLocale()` resolution. Previously both `searchSeries` and `getEpisodes`
  hardcoded `Locale.ENGLISH` regardless of what the client sent — the language selector was
  wired end-to-end at the transport layer but dead at the point of use. Both call sites now
  use `resolveLocale(request.language())`.
- `searchSeries` calls `provider.search(query, locale)` and maps each real
  `net.filebot.web.SearchResult` to a `SearchResultDto`, with `year` always set to `null` — see
  §6, this is not a bug.
- `getEpisodes` calls `provider.getEpisodeList(searchResult, sortOrder, locale)` — a real
  provider call, not a fabrication — then filters the returned `List<Episode>` by
  `request.seasonFilter()` **server-side**, before mapping to DTOs. This filtering path is
  fully implemented and correct; see §4 for why the frontend doesn't currently exercise it on
  every scoped fetch.
- `getFormattedEpisodeList` re-fetches episodes via `getEpisodes(request)`, then binds each one
  through the real `net.filebot.format.ExpressionFormat`/`MediaBindingBean` pipeline (the same
  engine spec 03 documents) against a freshly reconstructed `Episode` object. Reachable only
  via the one REST endpoint above; nothing in the frontend calls it.
- All exceptions (network failure, provider 4xx/5xx, malformed response) are swallowed into an
  empty list at each public method boundary — the frontend has no way to distinguish "no
  results" from "the provider call failed," and always shows the same
  `"No TV series found matching ..."` / `"No episodes found."` message either way.

---

## 4. Season Filtering — Real Server Support, Client-Side-Only Usage

`EpisodeFetchRequestDto.seasonFilter` and the server-side filter loop in `getEpisodes` are
fully implemented and correct (§3). However, `EpisodesExplorerPanel.tsx`'s
`fetchEpisodesForSeries` never passes a `season` argument — every fetch retrieves the entire
series, and the season `<select>` (populated from `Array.from(new Set(episodes.map(ep =>
ep.season)))`, i.e. derived from the already-fetched full list) filters the in-memory
`episodes` array client-side via `filteredEpisodes`. This means:

- Season selection only ever costs the network round-trip once (whole series), then filters
  for free — a real, working behavior today, just not the most efficient one for series with
  many seasons.
- Changing the season filter does **not** trigger a new fetch, and there is no gating on
  provider capability (some providers have no per-season concept) — the `<select>` is always
  enabled and always populated from whatever is already loaded.
- No "season out of bounds" error state exists; an empty selection just shows zero rows.

If a future change threads `season` through to the REST call on every selection, remember to
also add a distinct "this season doesn't exist for this series" UI state, since the server
loop currently can only produce "zero episodes after filtering," indistinguishable from "still
loading" or "provider returned nothing."

---

## 5. Cross-Panel & Export Actions

- **"Send to Rename" (right-click context menu on an episode row):** calls
  `onNavigateTab?.('RENAME', files)`, where `files` is the `files` prop passed down from
  `AppShell.tsx` — i.e. whatever paths are currently sitting in `AppShell`'s `droppedFiles`
  state (populated by dropping files anywhere in the app via `GlobalDropZone`, since it wraps
  every tab). This is a **pure tab-navigation convenience**, mirroring the pattern already used
  by `AnalyzePanel.tsx`'s "Send to" menu — it switches the active tab to Rename and hands over
  whatever files were already dropped. **It does not send the clicked episode's metadata, and
  there is no binding between the episode row and the transferred files.** If a real
  "pre-populate the Rename match for this specific episode" workflow is wanted, that requires a
  new payload shape (e.g. threading the target `EpisodeDto` through `onNavigateTab` and having
  `RenameWorkspace` accept a pre-seeded match) — not present today.
- **"Save as..." button:** genuinely functional, no backend call. Builds `"{series} -
  {season}x{episode:02} - {title}"` lines from `filteredEpisodes` client-side, copies the text
  to the clipboard (`navigator.clipboard.writeText`), and triggers a browser download of the
  same content as `{seriesName}-List.txt` via a `Blob`/`URL.createObjectURL` anchor click. The
  line format is hardcoded in the component, not driven by the user's actual Rename format
  expression or any server-side formatter.

---

## 6. Known Gaps / Deliberately Deferred

1. **Disambiguation year hint is always empty by design, not a bug.** The legacy web-services
   layer's `net.filebot.web.SearchResult` class carries no year field at all — `SearchResultDto
   .year()` is hardcoded to `null` in `searchSeries()` because there is nothing to populate it
   with. Do not "fix" this by inventing a year lookup unless a specific provider API that
   returns one is identified and wired in as a real, separate enhancement.
2. **No keyboard season-navigation shortcuts** (legacy binds Shift+Up/Shift+Down to spin the
   season selector without a mouse). Not implemented.
3. **Season `<select>` is not gated by provider capability.** Legacy locks the season control
   to "All Seasons" when the selected provider has no real per-season concept
   (`!provider.hasSeasonSupport()`); the React `<select>` here is always enabled regardless of
   provider. Lower-impact than it sounds because of §4 (filtering is already purely
   client-side, so an ungated selector can't actually break a real request), but the guard
   itself doesn't exist.
4. **Search history is session-local only.** `searchHistory` is a plain `useState<string[]>`
   capped at 10 entries, lost on reload. Legacy seeds its equivalent autocomplete from
   `MediaDetection.releaseInfo`'s bundled index of every known series name — a materially
   larger, persistent feature that has not been ported. What exists today only re-runs a query
   this session has already run once.
5. **Language selector covers 4 of the 16 `LanguageCode` values** (EN/DE/FR/ES) — narrower than
   what the backend and shared domain model support.
6. **`getFormattedEpisodeList`'s controller wrapper ignores the caller's provider/language**
   (§2) — currently unreachable dead behavior since nothing calls it, but a latent bug for
   whoever wires a caller to it next.
