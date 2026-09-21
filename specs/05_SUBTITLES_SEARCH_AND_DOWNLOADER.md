# Subtitles Search & Downloader Specification

**Status:** As-built. This document describes the Subtitles workspace as it is actually
implemented (frontend: `frontend/src/components/SubtitlePanel.tsx`; backend:
`net.filebot.backend.controller.SubtitleController`,
`net.filebot.backend.service.SubtitleService`/`SubtitleServiceImpl`). This area previously
had a **100% fabricated backend**: search results were synthesized strings built from the
input filename, and download wrote zero bytes to disk while unconditionally reporting
success. Both are now real. Where the implementation deliberately simplifies vs. the legacy
Swing `SubtitleAutoMatchDialog`/`SubtitleUploadDialog`, that is called out explicitly.

---

## 1. UI: `SubtitlePanel.tsx`

A two-column grid, one row per loaded video file:

- **Left column ("Video"):** the video file's path.
- **Right column ("Subtitle"):** the currently matched subtitle name (or "No subtitles
  searched"). Clicking a row with candidates expands an inline list of every candidate found
  for that video (`row.candidates`), each selectable (`handleSelectCandidate`); a
  "Cancel selection" row clears the match back to none.
- **Right-click on a row whose subtitle has already been downloaded** (`row.downloadedPath`
  is set) opens a context menu with:
  - **Preview** — fetches the real file content via `GET /subtitles/content` and shows it in
    a modal (`<pre>` block, monospace).
  - **Save As / Export** — fetches the same content and triggers a browser download
    (`Blob` + `<a download>`), so it downloads by client-visible filename regardless of where
    the backend actually wrote the file server-side.

**Bottom toolbar:**
- **Exact Search** / **Fuzzy Search** buttons — see §2 for what these actually trigger.
- **Load Videos** — file picker, routed through `appApi.intakeFiles(paths, 'SUBTITLES')` (real
  recursive/hidden-file-filtered intake, see spec 01 §3) with a raw-path fallback if intake
  fails.
- **Language** `<select>` — all 16 `LanguageCode` values (previously only 4 of 16 were
  offered).
- **Subtitle Naming** `<select>` — bound to `SubtitleNamingStrategy`
  (`MATCH_VIDEO_ADD_LANGUAGE_TAG` default / `ORIGINAL` / `MATCH_VIDEO`) and actually sent in
  the download request (previously captured in React state but never transmitted at all —
  the dropdown had zero effect on the real output filename).
- **Download** — see §4.
- **Close** — clears all rows client-side.

There is **no separate upload UI** and **no distinct upload-vs-download drop targets** — see
§6.

---

## 2. Real Search: `POST /api/v1/subtitles/search`

```java
public record SubtitleSearchRequestDto(
    List<String> videoFilePaths, LanguageCode language,
    SubtitleProviderType provider,       // OPEN_SUBTITLES (default) | SHOOTER
    SubtitleSearchStrategy strategy)     // EXACT (default) | FUZZY
    implements Serializable {}

public record SubtitleDescriptorDto(
    SubtitleProviderType provider, String id, String name, LanguageCode language,
    SubtitleFormat format, double score, String downloadUrl, String videoFilePath)
    implements Serializable {}
```

`SubtitleServiceImpl.searchSubtitles()` dispatches on **two independent axes** —
`provider` and `strategy` — which the UI used to incorrectly conflate (the old "Exact" button
sent `provider=OPEN_SUBTITLES`, "Fuzzy" sent `provider=SHOOTER`, and the backend ignored the
distinction entirely, hitting an identical fabricated code path either way). The real
dispatch:

```java
if (providerType == SubtitleProviderType.SHOOTER) {
  // Shooter is a hash-only lookup service - no name-search variant exists at all.
  resultsByFile = SubtitleUtilities.lookupSubtitlesByHash(WebServices.Shooter, videoFiles, locale, true, false);
} else if (request.strategy() == SubtitleSearchStrategy.FUZZY) {
  resultsByFile = SubtitleUtilities.findSubtitlesByName(WebServices.OpenSubtitles, videoFiles, locale, null, true, false);
} else {
  resultsByFile = SubtitleUtilities.lookupSubtitlesByHash((VideoHashSubtitleService) WebServices.OpenSubtitles, videoFiles, locale, true, false);
}
```

- **`net.filebot.subtitle.SubtitleUtilities.lookupSubtitlesByHash(...)`** — real hash-based
  lookup (video-hash fingerprint matched server-side against the provider's database). Used
  for `strategy=EXACT` against OpenSubtitles, and always for `provider=SHOOTER` regardless of
  `strategy` (Shooter has no name-search variant in legacy either).
- **`SubtitleUtilities.findSubtitlesByName(...)`** — real name/query-based search. Used for
  `strategy=FUZZY` against OpenSubtitles only.
- The frontend's "Exact Search" button now sends `provider=OPEN_SUBTITLES, strategy=EXACT`;
  "Fuzzy Search" sends `provider=OPEN_SUBTITLES, strategy=FUZZY`. There is currently no UI
  control to select `provider=SHOOTER` explicitly — Shooter is reachable via the API
  (`SubtitleSearchRequestDto.provider`) but not from this panel's buttons today.

**Result → DTO mapping and the `videoFilePath` field:** each real `SubtitleDescriptor`
returned by the provider is assigned a synthetic `id` (`UUID.randomUUID()`) and cached
server-side (see §3), then mapped to a `SubtitleDescriptorDto` carrying the **video file it
was found for** in `videoFilePath`. This field exists because a provider can return a
variable number of real candidates per video — a flat result array with positional
`results[i] <-> rows[i]` correspondence (the old contract) is structurally incapable of
representing "3 candidates for video A, 0 for video B, 1 for video C." The frontend groups
results by `videoFilePath` before attaching them to rows:

```ts
const resultsByVideo = new Map<string, SubtitleDescriptor[]>();
results.forEach((r) => {
  const list = resultsByVideo.get(r.videoFilePath) ?? [];
  list.push(r);
  resultsByVideo.set(r.videoFilePath, list);
});
```

`language` is resolved to a real `java.util.Locale` via `Language.getLanguage(code).getLocale()`
before being passed to the provider client. `descriptor.getLanguageName()` (a display string,
e.g. "English") is mapped back to a `LanguageCode` via `Language.findLanguage(name)`, falling
back to the request's language or `EN` if that lookup fails.

---

## 3. The Session-Scoped Descriptor Cache (why download needs a prior search)

```java
private final Map<String, SubtitleDescriptor> descriptorCache = new ConcurrentHashMap<>();
```

A real `net.filebot.web.SubtitleDescriptor` (the provider's live object, capable of
`.fetch()`-ing its own bytes) cannot be meaningfully serialized to JSON and handed back to
the client — only its synthetic `id` crosses the wire. `downloadSubtitles()` looks the
descriptor back up by that `id`. **This means a subtitle can only be downloaded within the
same backend process/session that served the search that found it** — restarting the backend,
or searching from a different backend instance, invalidates every outstanding `id`. This is a
deliberate, documented simplification (a full solution would persist descriptors or
re-resolve them from a stored query), not a bug: it matches how the UI is actually used in
practice (search, then immediately download in the same sitting) and keeps the service
stateless in every other respect.

---

## 4. Real Download: `POST /api/v1/subtitles/download`

```java
public record SubtitleDownloadRequestDto(
    String videoFilePath, String subtitleId, SubtitleProviderType provider,
    SubtitleFormat targetFormat, SubtitleNamingStrategy namingStrategy)
    implements Serializable {}

public record SubtitleDownloadResultDto(
    int successCount, int failureCount, List<String> downloadedSubtitlePaths)
    implements Serializable {}
```

For each request, `SubtitleServiceImpl.downloadSubtitles()`:
1. Looks up the cached `SubtitleDescriptor` by `subtitleId` (fails the row if not found —
   e.g. stale id, or backend restarted since search).
2. Calls **`SubtitleUtilities.fetchSubtitle(descriptor)`** — a real network fetch of the
   subtitle bytes (`descriptor.fetch()`), which also handles the case where the provider
   returns a compressed archive (`ArchiveType.forName(descriptor.getType())`) by extracting
   the actual subtitle entry from it.
3. Builds the output filename via **`net.filebot.subtitle.SubtitleNaming`** (the real legacy
   enum, mirrored 1:1 by `SubtitleNamingStrategy`), selected by `request.namingStrategy()`:
   `ORIGINAL` keeps the provider's subtitle name, `MATCH_VIDEO` renames to match the video's
   base name, `MATCH_VIDEO_ADD_LANGUAGE_TAG` (default) additionally appends the subtitle's
   language.
4. Writes the fetched bytes for real, next to the video file
   (`new File(video.getParentFile(), fileName)`), via a `FileOutputStream`/`FileChannel`.
5. Reports the real output path in `downloadedSubtitlePaths` only for genuine successes.

**Frontend caveat on result attribution:** `downloadedSubtitlePaths` lists only successful
downloads, in request order — with partial failures the array can't be zipped positionally
back onto UI rows. `SubtitlePanel.tsx`'s `handleDownload()` only attaches
`row.downloadedPath` (enabling the Preview/Save-As context menu) when
`res.successCount === matchedRows.length`, i.e. the whole batch succeeded; a partial-failure
batch still reports success/failure counts correctly but leaves no per-row downloaded-path
data to preview from.

---

## 5. `computeOpenSubtitlesHash` (positive control — was already correct)

`GET /api/v1/subtitles/hash?filePath=...` calls `net.filebot.web.OpenSubtitlesHasher.computeHash(file)`
— a byte-for-byte port of the legacy 64KB-block video-hash algorithm. This was genuinely
correct before this implementation pass and required no fix; it's the input to the real
`lookupSubtitlesByHash` search path described in §2.

---

## 6. Known Gaps / Deliberately Deferred

- **Subtitle upload is a documented no-op.** `SubtitleServiceImpl.uploadSubtitle()`'s entire
  body is a comment explaining why: porting legacy's `SubtitleUploadDialog` (video/subtitle/
  IMDb/language table with CD-grouping) and wiring `net.filebot.web.OpenSubtitlesClient`'s
  real upload API is a substantial net-new UI build, not a quick fix, and needs a product
  scope decision first (is subtitle upload even a priority for this port?) before investing
  in it.
- **No OpenSubtitles login / VIP-quota modal.** Legacy's `SubtitlePanel` shows one; nothing
  equivalent exists here. Moot until real account-aware behavior (upload, quota-gated
  downloads) is built.
- **No distinct upload-vs-download drop targets.** Legacy has two separate circular drop
  zones; this UI has a single generic file picker for loading videos. This follows directly
  from upload being unbuilt — there's nothing to drop onto yet.
- **No right-click context menu on search *candidates*** (only on already-downloaded rows).
  Legacy also exposes Preview/Save As/Export on not-yet-downloaded candidates from provider
  metadata; here Preview/Save As require the file to already be on disk.
- **Shooter is not reachable from the Exact/Fuzzy buttons.** It's a fully real, working
  provider (`provider=SHOOTER` in the API), just not wired to any button in the current UI —
  a small, low-risk follow-up (add a provider selector) rather than a backend gap.
