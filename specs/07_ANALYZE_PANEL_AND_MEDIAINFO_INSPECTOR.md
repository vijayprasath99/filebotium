# Analyze Panel & MediaInfo Inspector Specification

**Status:** As-built. Describes the system as actually implemented (frontend:
`frontend/src/components/AnalyzePanel.tsx`; backend:
`net.filebot.backend.controller.AnalyzeController`,
`net.filebot.backend.service.{AnalyzeService,AnalyzeServiceImpl,MediaInfoInspectorService,MediaInfoInspectorServiceImpl}`).
Four of this panel's five tabs (Archives, Parts, Attributes, Types) were originally 100%
client-side regex/string fakes with zero backend method behind them; all four now call real
backend logic that in turn calls real legacy FileBot classes. Where a gap remains, it is
called out explicitly in §7 rather than silently glossed over.

---

## 1. Layout & Navigation

`AnalyzePanel` renders two panes:

- **Left: File Tree.** A flat list of the currently loaded files (`treeFiles` state), with a
  single expand/collapse "Loaded Files (N)" root row. "Load" opens a native multi-file picker
  (`<input type="file" multiple>`); "Clear" resets all panel state (tree, type groups, part
  groups, selected archive/attributes/inspection data).
- **Right: tab bar + detail view.** Five tabs: **Archives, Types, Parts, Attributes,
  MediaInfo** (Types is the default active tab). Each tab's content is computed once, when
  files are loaded (`populateFiles`), except Archives/Attributes/MediaInfo which fetch
  per-selection on demand.

Files arrive from two places: the panel's own "Load" button/file input, or the `files` prop
passed down from `AppShell.tsx` (dropped via the global drop zone while the Analyze tab is
active). Loading via the file input goes through `appApi.intakeFiles(rawPaths, 'ANALYZE')`
first (real recursive/hidden-file-filtered intake — see spec 01 §3) before falling back to the
raw picked paths if intake fails.

### Context menu

Right-clicking anywhere in the tab content area (or on a Types-tab group row) opens a context
menu with:

| Item | Behavior |
|---|---|
| **Send to → Rename / SFV / List** | `onNavigateTab(tab, files)` where `files` is the selected Types group's file list if one is selected, otherwise the full `treeFiles` list. Purely a frontend tab-switch + file hand-off; no backend call. |
| **Reveal** | Calls `revealInFileManager(selectedFile, false)` (see spec 01 §5 for the Electron IPC contract) — opens the OS file manager with the file highlighted. Shows an error status message if not running inside Electron. |
| **Reveal Folder** | `revealInFileManager(selectedFile, true)` — same IPC call, targeting the file's parent directory. |
| **Move to Trash** | Confirms with `window.confirm`, then calls `moveToTrash(selectedFile)` (`window.electronAPI.moveToTrash`, backed by Electron's `shell.trashItem`). On success, removes the file from `treeFiles` locally and shows a confirmation status message. |
| **Expand all / Collapse all** | Toggles `expandedTypes` for every Types-tab group. Frontend-only. |

Reveal/Reveal Folder/Move to Trash all resolve to no-ops with a "Not available outside the
desktop app." status message when running in a plain browser (no `window.electronAPI`).

---

## 2. Archives Tab

**Endpoint:** `GET /api/v1/analyze/archive/entries?path={archiveFilePath}` →
`List<ArchiveEntryDto>`

```java
public record ArchiveEntryDto(String name, String path, long size) implements Serializable {}
```

The left column lists every loaded file matching `/\.(zip|rar|7z|tar|gz|bz2|xz|iso)$/i`
(`ARCHIVE_EXTENSIONS`, a client-side extension filter used only to decide what's clickable —
the actual entry listing is always server-computed, never guessed from the filename). Clicking
one calls `analyzeApi.listArchiveEntries(path)`, which invokes
`AnalyzeServiceImpl.listArchiveEntries`:

```java
try (Archive archive = Archive.open(archiveFile)) {   // net.filebot.archive.Archive
  List<FileInfo> entries = archive.listFiles();          // real native 7-Zip binding
  ...
} catch (Exception e) {
  return Collections.emptyList();
}
```

`Archive.open(...)` dispatches to `Archive.getExtractor()` (default
`SevenZipNativeBindings`), so this depends on the native `sevenzipjbinding` libraries being
loadable on the host. Any failure (missing native lib, corrupt/unsupported archive, encrypted
archive) is caught and surfaced as an **empty entry list** with the message "No entries found
(or archive support unavailable on this system)" — not a distinguishable error state. The
right column shows each `ArchiveEntryDto`'s `path` and formatted `size` (`formatBytes`
helper — binary units, `B/KB/MB/GB/TB`).

Clicking an archive row no longer routes to the MediaInfo inspector (the original bug this
tab shipped with) — it exclusively drives the Archives-tab entry list.

---

## 3. Parts Tab

**Endpoint:** `POST /api/v1/analyze/parts?splitSizeMB={n}` (body: `List<String>` file paths,
`splitSizeMB` defaults to `4480`) → `List<FileGroupDto>`

```java
public record FileGroupDto(String name, List<String> files, long totalSizeBytes)
    implements Serializable {}
```

Computed once per `populateFiles(fileList)` call (i.e. whenever files are (re)loaded), using
the default 4480 MB split size — there is currently no UI control to change `splitSizeMB`
(the endpoint parameter exists and works; the frontend just never sends a non-default value).

`AnalyzeServiceImpl.groupIntoParts` ports legacy `SplitTool.createModelInBackground`'s
bin-packing loop verbatim (plain `File`/`long` arithmetic, no Swing dependency):

1. Sort input files.
2. Files individually larger than the split size go into a **"Remainder"** group.
3. Otherwise, accumulate files into the current "Disk N" group; once adding the next file
   would exceed the split size, close the current group and start "Disk N+1".
4. Return one `FileGroupDto` per disk plus (if non-empty) one "Remainder" group.

The UI renders each group as a card: `{name} ({file count} files, {formatBytes(totalSizeBytes)})`
with its member files listed underneath (clicking one calls `handleInspectFile`, jumping to
the MediaInfo tab's data for that file). This replaced a purely cosmetic heuristic that
matched filenames already *looking* pre-split (`.part1`, `.r00`, `.001`, etc.) instead of
actually grouping files by size.

---

## 4. Attributes Tab

**Endpoint:** `GET /api/v1/analyze/attributes?path={filePath}` → `Map<String, String>`

`AnalyzeServiceImpl.getFileAttributes` reads real OS extended attributes / FileBot rename
metadata via the same singleton used elsewhere in the backend
(`net.filebot.media.XattrMetaInfo.xattr`, statically imported):

```java
String originalName = xattr.getOriginalName(file);   // FILENAME_KEY xattr, if FileBot set one
Object metaInfo = xattr.getMetaInfo(file);            // METADATA_KEY xattr (Episode/Movie), if set
```

The returned map has at most two keys:
- `"originalName"` — the filename FileBot renamed this file *from*, if that xattr was written
  (only present for files that were previously renamed by a version of FileBot with extended
  attributes enabled).
- `"metadata"` — a JSON string (via `net.filebot.media.MetaAttributes.toJson`) of the bound
  `Episode`/`Movie` object, if one is stored.

Missing file, unsupported filesystem, or a read failure of any kind all fall through to
returning whatever was collected so far (commonly an empty map) — there is no distinct
"unsupported on this platform" vs. "no metadata was ever set" status; both render the fallback
message "No FileBot rename metadata stored on this file." in the UI. The tab always shows the
selected file's `Full Path`/`Extension` (computed client-side from the path string) plus these
two xattr-derived fields when present, with `metadata` rendered as a formatted JSON block.

This is the exact same xattr mechanism that populates `MediaFileDto.xattrs` elsewhere in the
backend (spec 00 §3.1) — `AnalyzeServiceImpl.getFileAttributes` is the only current caller
that surfaces it to the UI, though.

---

## 5. Types Tab

**Endpoint:** `POST /api/v1/analyze/types` (body: `List<String>` file paths) →
`List<FileGroupDto>`

Computed once per `populateFiles(fileList)` call, alongside Parts. `AnalyzeServiceImpl.classifyByType`
ports legacy `TypeTool.getMetaTypes()` verbatim — a fixed, ordered set of classification
filters evaluated in this order, each producing one group if it matches at least one file:

```java
"Movie"        -> MediaDetection.isMovie(f, true)
"Episode"      -> MediaDetection.isEpisode(f, true)
"Disk Folder"  -> MediaDetection.getDiskFolderFilter()
"Video"        -> MediaTypes.VIDEO_FILES
"Subtitle"     -> MediaTypes.SUBTITLE_FILES
"Audio"        -> MediaTypes.AUDIO_FILES
"Archive"      -> MediaTypes.ARCHIVE_FILES
"Verification" -> MediaTypes.VERIFICATION_FILES
"Extras"       -> MediaDetection.getClutterFileFilter()
"Clutter"      -> MediaDetection.getClutterTypeFilter()
```

After these named groups, every remaining file is additionally grouped by file extension
(`FileUtilities.mapByExtension`, alphabetically sorted) — a file can therefore appear in more
than one group (e.g. a video file appears under both "Video" and its extension group, such as
"mkv"). `FileGroupDto.totalSizeBytes` is a real `long` sum of `File.length()` across the
group's members — this replaced a version where the "size" field was literally the string
`"N file(s)"`.

The UI renders each group as `{name} ({count} files, {formatBytes(totalSizeBytes)})`,
expandable to list member files. Selecting a group (`selectedTypeIdx`) also determines which
file set the "Send to" context-menu action hands off.

---

## 6. MediaInfo Tab

**Endpoints:**
- `GET /api/v1/analyze/inspect?path={filePath}` → `MediaInfoInspectorDto` (single file)
- `POST /api/v1/analyze/batch-inspect` (body: `List<String>` file paths) →
  `List<MediaInfoInspectorDto>` (batch — see "Compare All Files" below)

```java
public record MediaInfoInspectorDto(
    String filePath, String containerFormat, long durationMs, long totalBitrate,
    List<VideoStreamDto> videoStreams, List<AudioStreamDto> audioStreams,
    List<SubtitleStreamDto> subtitleStreams) implements Serializable {}

public record VideoStreamDto(
    int streamIndex, String codec, int width, int height, double frameRate,
    int bitDepth, String hdrFormat) implements Serializable {}

public record AudioStreamDto(
    int streamIndex, String codec, int channels, int samplingRateHz, String language,
    long bitrate) implements Serializable {}

public record SubtitleStreamDto(
    int streamIndex, String format, String language, boolean isDefault, boolean isForced)
    implements Serializable {}
```

`MediaInfoInspectorServiceImpl.inspectFile` binds to the real native `libmediainfo` library
via `net.filebot.mediainfo.MediaInfo` (JNA), reading `General`/`Video`/`Audio`/`Text` stream
kinds. This was already a genuine implementation before this session's fixes; two specific
defects were corrected:

1. **HDR detection.** Now reads the real `HDR_Format` key (falling back to
   `HDR_Format_Compatibility` if blank) instead of `colour_primaries`, which produced spurious
   "HDR" badges on ordinary wide-gamut SDR content and missed real Dolby Vision/HDR10+.
2. **Missing native library handling.** `MediaInfoException` (thrown by `new MediaInfo()`
   when the native library can't be loaded) is now caught in its own `catch` clause **before**
   the generic `catch (Exception e)`, returning `containerFormat = "NATIVE_LIBRARY_MISSING"`.
   The frontend checks for this sentinel value and renders a dedicated "MediaInfo native
   library not available." message instead of an empty/blank inspection result indistinguishable
   from "this file just has no media streams."

Any other exception (corrupt file, unreadable path, etc.) still falls through to the generic
handler, returning `containerFormat = "UNKNOWN"` with empty stream lists — this case remains
indistinguishable from "genuinely no data," which is a known limitation (see §7).

### Compare All Files

A "Compare All Files (N)" button (enabled once ≥2 files are loaded) calls
`analyzeApi.batchInspect(treeFiles)` — wiring in the previously-unused `batchInspect` endpoint
(`MediaInfoInspectorServiceImpl.batchInspect` just loops `inspectFile` per path; no separate
batch-optimized logic). Results replace the single-file view with a compact table: File name /
Container / first video stream (`codec WxH`) / first audio stream (`codec Nch`) / Duration.
"Back to single file" clears `comparisonData` and returns to the normal single-selection view.
This is a flat comparison table, not a full field-by-field diff highlighting differences
between files.

---

## 7. Known Gaps / Deliberately Deferred

- **No inline search/filter** on any tab's results (Archives entries, Types/Parts groups,
  file tree) — everything is a flat scrollable list.
- **No "Extract Archive" UI action**, even though the backend capability exists and is
  trivial to add: `net.filebot.archive.Archive.extract(File outputDir[, FileFilter filter])`
  is a real, available method that `AnalyzeServiceImpl` does not yet expose via any endpoint.
- **Archive listing failures are indistinguishable from "genuinely empty archive."** Both a
  missing native 7-Zip library and a truly empty/unsupported archive return `[]`. Distinguishing
  these would require `listArchiveEntries` to propagate a specific error rather than swallowing
  every exception.
- **`splitSizeMB` is not user-configurable in the UI** (endpoint parameter works; no control
  calls it with anything but the default `4480`).
- **MediaInfo's generic failure path** (`containerFormat = "UNKNOWN"`) still conflates "file
  has no readable media streams" with "an unexpected error occurred while inspecting it" —
  only the specific native-library-missing case was split out.
- **Compare All Files** is a fixed-column summary table; it does not highlight per-file
  differences or let the user choose which fields to compare.
