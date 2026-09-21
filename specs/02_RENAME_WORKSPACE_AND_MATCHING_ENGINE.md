# Rename Workspace & Matching Engine Specification

**Status:** As-built. This is the app's core value proposition and, as of this revision, the
matching engine performs real provider lookups — earlier drafts of this feature returned a
hardcoded `0.85` similarity score and `null` metadata for every file, regardless of provider,
mode, or filename. That stub has been replaced end to end. Read `specs/00...` first for the
shared architecture, enums, and DTO conventions this spec builds on.

Frontend: `frontend/src/components/RenameWorkspace.tsx`, `MatchTableContainer.tsx`,
`FormatEditorModal.tsx`, `EpisodeBindingsModal.tsx`, `PresetManagerModal.tsx`.
Backend: `net.filebot.backend.controller.RenameWorkspaceController`, `PresetController`;
`net.filebot.backend.service.RenameWorkspaceServiceImpl`, `PresetServiceImpl`.

---

## 1. UI Layout & Interaction (`RenameWorkspace.tsx` + `MatchTableContainer.tsx`)

A two-column layout with a resizable center split (persisted in `localStorage` under
`filebot_rename_split_percent`, double-click the divider to reset to 50/50):

- **Left — "Original Files":** flat list of loaded/dropped source file paths. Click to select
  (`selectedOriginalIdx`). **Double-click a row to reveal it in the OS file manager** via
  `revealInFileManager()` (`frontend/src/utils/fileUtils.ts`, Electron IPC `reveal-in-folder` —
  no-op with a rejected promise outside Electron).
- **Center — Match / Rename buttons.**
- **Right — "New Names":** one row per `Match`, rendered with:
  - An **exclude checkbox** bound to `Match.isExcluded`. Excluded rows are skipped by both
    `applyFormat` (format re-evaluation) and `executeRename` (the actual file operation) on
    the backend — this is a real, honored flag, not cosmetic.
  - A **warning highlight** (`score < 0.8` or `status === 'CONFLICT'`) and a small
    checkmark icon when `status === 'MANUAL'`.
  - **Manual filename override:** press **F2** with a row selected, or **double-click** a row,
    to turn it into an inline text input. Enter commits (calls `onManualRename(idx, newName)`,
    which sets `formattedName`/`formattedPath` locally and flips `status` to `MANUAL`); Escape
    or blur-without-Enter cancels/commits per the current value. This is a **local, frontend-only**
    override — it does not round-trip through the backend until the row is actually renamed via
    `executeRename`.
- **Top bar:** Mode (`TV`/`MOVIE`/`ANIME` — `MUSIC`/`AUTO` exist as `MatchingMode` values but
  are not offered in this dropdown, see §6), Provider (`THE_TVDB`/`THE_MOVIE_DB`/`ANI_DB`/
  `TV_MAZE`), Action (`MOVE`/`COPY`/`HARDLINK`/`SYMLINK`), and a "Base Folder Override" text
  input — a workaround for browsers that only expose a filename (not an absolute path) from
  `<input type=file>`; when set, `resolvePaths()` prefixes bare filenames with it before
  matching. Electron's `getFilePath()` (via `webUtils.getPathForFile`) normally makes this
  unnecessary.
- **Bottom toolbar:** Shift Up/Down (swap the selected row with its neighbor — see §2.4), Load
  (file picker → `appApi.intakeFiles`), Fetch Data (alias for Match), Format (opens
  `FormatEditorModal`), **Preset Manager** (bookmark icon, opens `PresetManagerModal` — §5),
  Close/Clear.

---

## 2. The Real Matching Pipeline

### 2.1 Request/response contract

```
POST /api/v1/rename/match
Request:  MatchRequestDto(filePaths: string[], provider: ProviderType, mode: MatchingMode,
                          language: LanguageCode, formatExpression: string)
Response: MatchDto[]
```

```java
public record MatchDto(
    String matchId, MediaFileDto sourceFile, Object targetMetadata, double score,
    String formattedName, String formattedPath, boolean isExcluded, MatchStatus status)
```

`RenameWorkspaceServiceImpl.autoMatch(MatchRequestDto)` is the entry point. It never throws to
the caller — any provider/network exception during matching is caught and swallowed, and the
method falls back to filename-only formatting (real metadata `null`, `MatchStatus.PENDING`)
for every file rather than failing the whole batch.

### 2.2 Per-mode matching logic

| `mode` | Path |
|---|---|
| `TV` | `matchEpisodes(files, provider, locale, anime=false)` |
| `ANIME` | `matchEpisodes(files, provider, locale, anime=true)` |
| `MOVIE` | `matchMovies(files, provider, locale)` |
| `AUTO` | `matchEpisodes(...)` first, then `matchMovies(...)` on whatever remains unmatched |
| `MUSIC` | **No-op** — see §6 |

**Episode matching** (`matchEpisodes`):
1. Resolve the real provider client from `net.filebot.WebServices` (pre-wired, real API keys —
   `resolveEpisodeProvider`: `THE_MOVIE_DB → WebServices.TheMovieDB_TV`,
   `ANI_DB → WebServices.AniDB`, `TV_MAZE → WebServices.TVmaze`,
   default/`THE_TVDB → WebServices.TheTVDB`).
2. `net.filebot.media.MediaDetection.detectSeriesNames(mediaFiles, anime, locale)` guesses one
   or more series-name queries from the filenames. If it finds none, fall back to the first
   file's basename (`FileUtilities.getName`) as a single query.
3. For each query, `provider.search(query, locale)` → take the **first** search result (no
   disambiguation UI — this is a headless service, there is no dialog to show), then
   `provider.getEpisodeList(result, SortOrder.Airdate, locale)` to build a pooled
   `Set<Episode>` across all queries.
4. `new net.filebot.similarity.EpisodeMatcher(mediaFiles, episodePool, strict=false).match()`
   — the real legacy episode-to-file matcher (SxE pattern parsing, multi-episode detection,
   etc.) — assigns each file at most one `Episode`.

**Movie matching** (`matchMovies`): per file, `MovieIdentificationService` resolved via
`resolveMovieProvider` (`OMDB → WebServices.OMDb`, otherwise `WebServices.TheMovieDB`), then
`net.filebot.media.MediaDetection.detectMovie(file, service, locale, strict=false)` — real
xattr/NFO/filename-based movie detection, including online lookup — and the first ranked
result is taken.

Unmatched files (no `Episode`/`Movie` found) still produce a `MatchDto` with
`targetMetadata = null`, `score = 0.0`, `status = PENDING`, and `formattedName` equal to the
plain filename (or the raw-file format-expression evaluation, see §2.3) — they are not dropped
from the response.

### 2.3 Format evaluation & scoring

For each file, if `formatExpression` is non-blank:
```java
ExpressionFormat format = new ExpressionFormat(formatExpression);
MediaBindingBean bindingBean = new MediaBindingBean(metadata != null ? metadata : file, file, null);
Object result = format.format(bindingBean);
```
— i.e. once a real `Episode`/`Movie` is matched, format bindings like `{n}`, `{s00e00}`, `{t}`
resolve against **real metadata**, not the file bound to itself. On any evaluation exception,
the original filename is kept as a fallback (never throws to the client).

`score` is computed via `net.filebot.similarity.NameSimilarityMetric.getSimilarity(fileBaseName,
metadata.toString())` — a real (if approximate) string-similarity score between the filename
and the matched object's string form, not a constant. Unmatched files score `0.0`.

### 2.4 Reordering & re-formatting

```
POST /api/v1/rename/align?sourceIndex=&targetIndex=   body: MatchDto[]  → MatchDto[]
POST /api/v1/rename/format?formatExpression=           body: MatchDto[]  → MatchDto[]
```
`updateRowAlignment` does a remove+insert on the list (correct for adjacent swaps — Shift
Up/Down only ever request adjacent indices — but not a true "move," so a non-adjacent
`sourceIndex`/`targetIndex` pair, which nothing in the UI currently sends, would shift every
element in between rather than swapping just two). `applyFormat` re-evaluates
`formattedName`/`formattedPath` for every non-excluded match against a new expression, reusing
each match's already-resolved `targetMetadata` — no re-matching occurs. The frontend calls this
automatically whenever the effective format expression changes (preset applied, or the Format
Editor's "Use Format" is clicked) via a `useEffect` on `effectiveFormatExpression`.

---

## 3. Executing the Rename

```
POST /api/v1/rename/execute
Request:  RenameExecutionRequestDto(matches: MatchDto[], action: FileAction,
                                     conflictStrategy: ConflictStrategy)
Response: RenameExecutionResultDto(transactionId, successCount, failureCount, errors: RenameErrorDto[])
```

`executeRename` maps `FileAction` to a real `net.filebot.StandardRenameAction`
(`MOVE`/`COPY`/`HARDLINK`/`SYMLINK`) and, for every **non-excluded** match whose source file
still exists, calls `renameAction.rename(source, destination)` for real. Per file, after a
successful rename:

1. **If `renameAction.canRevert()`** (true for all four actions above — only
   `StandardRenameAction.TEST`, which is never reachable through this API, returns `false`),
   the `(source → destination)` pair is added to a batch and, once the whole loop finishes,
   appended to `net.filebot.HistorySpooler.getInstance()` — **a real rename now writes to
   history**, making Undo (spec 08) actually work. This did not happen at all in an earlier
   revision of this service.
2. `TaskProgressPublisher.publishRenameProgress(transactionId, processed, total, path, pct)` is
   called (real STOMP frame to `/topic/rename/progress` — see spec 00 §5). The frontend does
   not currently subscribe to this topic from within the Rename workspace itself, only
   `AppShell.tsx` at the app level for generic notifications — a genuinely real-time per-file
   progress bar inside `MatchTableContainer` has not been built (nothing prevents adding one;
   the data is already flowing).

**`conflictStrategy` is accepted but not actually used.** `executeRename` never reads
`request.conflictStrategy()` — every execution behaves as if `OVERWRITE` were selected
(if the destination path is occupied, the underlying `StandardRenameAction` implementation's
own default overwrite/replace behavior applies, not a FileBot-level skip/fail/rename-with-
counter policy). The frontend always sends `'OVERWRITE'` literally
(`renameApi.executeRename(matches, action, 'OVERWRITE')`), so no user path currently exercises
the other three enum values. See §6 for why `AUTO_RENAME` specifically must not be implemented
by guessing at its semantics.

A source file that no longer exists at rename time is recorded as a per-file failure
(`RenameErrorDto`) without aborting the rest of the batch.

---

## 4. Format Editor & Episode Bindings Modals

`FormatEditorModal.tsx` — a single, mode-agnostic (`tv`/`movie` toggle is local UI state only,
not sent anywhere) text editor:
- Live-validates and live-evaluates the typed expression against the backend on a 200ms
  debounce: `POST /api/v1/format/validate` (syntax only) and `POST /api/v1/format/eval`
  (renders a live "preview" string or an error message) — see spec 03.
- "Load Preset from Settings" pulls `settings.tvFormat`/`settings.movieFormat` (the Settings
  screen's saved defaults, spec 09) into the editor, keyed by the local tv/movie toggle — this
  is a different, coarser concept from the Rename workspace's own Preset Manager (§5) and from
  per-`MatchingMode` presets; the two systems are not unified.
- A static `EXAMPLES` list of illustrative expressions (click to load).
- "Use Format" calls `onSave(expression)`, which in `AppShell.tsx` both updates the app-wide
  `formatExpression` state (flows down as the `RenameWorkspace` prop) **and** persists it back
  to Settings (`settingsApi.updateSettings({...settings, tvFormat: expression})`).

`EpisodeBindingsModal.tsx` — a reference table of available bindings (`GET /api/v1/format/bindings`,
optionally scoped to a sample file path), grouped by `BindingCategory`; clicking a row inserts
`{ bindingKey }` into the format expression via `onSelectBinding`. See spec 03 §2 for why the
binding catalog itself is a known-incomplete hardcoded list, not a real reflection-based
enumeration of `MediaBindingBean`.

---

## 5. Preset Manager

Previously **entirely absent**, both frontend and backend. Now a full CRUD feature:

```
GET    /api/v1/presets            → PresetDto[]
POST   /api/v1/presets            body: PresetDto   → PresetDto
DELETE /api/v1/presets/{name}
```

```java
public record PresetDto(
    String name, String formatExpression, ProviderType provider, MatchingMode mode,
    LanguageCode language, FileAction action)
```

**Storage:** `PresetServiceImpl` persists each preset as a Jackson-serialized JSON string under
`Preferences.userNodeForPackage(net.filebot.ui.rename.RenamePanel.class).node("presets")`, key
`"preset." + name`. This node is the *same location* legacy's own Preset Manager uses
(`RenamePanel.java`'s `Settings.forPackage(RenamePanel.class).node("presets")`), chosen so
presets live alongside other rename preferences — **but it is not wire-compatible with
legacy's on-disk format.** Legacy's `net.filebot.ui.rename.Preset` class has no no-arg
constructor (its only constructor takes `File`/`ExpressionFilter`/`Datasource`/etc.), and the
project's bundled `json-io` 4.14.1 cannot reflectively instantiate it —
confirmed during implementation via a failing round-trip test
(`JsonIoException: Could not instantiate net.filebot.ui.rename.Preset using any constructor`).
Reusing legacy's exact class for storage was attempted and abandoned for this reason; Jackson +
a plain DTO was used instead. A legacy desktop install's existing presets will **not** appear
here, and presets created here will not appear in legacy.

**Frontend (`PresetManagerModal.tsx`):**
- Lists all presets, each showing its format/mode/provider summary and (for the first 9) a
  numeric badge.
- "Save Current" creates a new preset from the Rename workspace's live
  `{formatExpression, provider, mode, language: 'EN', action}` (language is currently always
  sent as `'EN'` — the Rename workspace has no language selector of its own).
- Per-preset **Apply** (▶) and **Delete** (🗑) buttons.
- **1–9 keyboard shortcuts:** `RenameWorkspace.tsx` loads the first 9 presets on mount and
  whenever the Preset Manager closes, and a `keydown` listener (ignored while an `<input>`/
  `<textarea>` has focus) applies `quickPresets[key - 1]` when digits 1–9 are pressed —
  mirroring legacy `RenamePanel.installKeyStrokeActions()`'s numbered preset shortcuts.
- Applying a preset sets `provider`/`mode`/`action` state directly and stores
  `formatExpression` in a **local override** (`presetFormatOverride`) that takes precedence
  over the `formatExpression` prop from `AppShell` until the next time that prop itself changes
  (e.g. the user saves a new format via the Format Editor, or Settings reloads) — see
  `effectiveFormatExpression` in `RenameWorkspace.tsx`.

---

## 6. Known Gaps / Deliberately Deferred

- **`MatchingMode.MUSIC` is unimplemented.** `autoMatch`'s `switch` has an explicit no-op
  branch for `MUSIC` with a comment explaining why: no headless (non-interactive) port of
  legacy's `net.filebot.ui.rename.MusicMatcher` exists yet. The mode selector dropdown doesn't
  even offer "Music" as an option today, so this is unreachable from the UI, but the backend
  contract still accepts the enum value and will silently produce filename-only matches for it.
- **`AUTO` mode's fallback ordering (episodes, then movies) is a reasonable default, not a
  verified port of any specific legacy heuristic** — legacy's `AutoDetectMatcher` may use
  different tie-breaking logic; this was not independently cross-checked line-by-line.
- **`ConflictStrategy` is a documented no-op** (§3). In particular `AUTO_RENAME` has no
  identified legacy precedent anywhere in `ConflictDialog`/`StandardRenameAction` (legacy only
  offers skip or trash-and-overwrite) — implementing "append a numeric counter" behavior for it
  would be inventing new product behavior, not restoring a ported one. Confirm intent before
  building.
- **No per-match `FormatDialog`.** Legacy allows double-clicking a specific New-Names row to
  open a format editor scoped to that one match's real bound object. Here, double-click only
  offers the plain-text manual filename override (§1) — there is no per-row live-binding
  preview separate from the global Format Editor.
- **`updateRowAlignment` is remove+insert, not a true move-swap**, for non-adjacent indices
  (§2.4) — harmless today because the UI only ever requests adjacent swaps.
- **No drag-to-reorder** in the New Names list; Shift Up/Down buttons are the only reordering
  mechanism.
- **Rename-workspace progress bar:** WebSocket rename-progress frames are published for real
  during `executeRename` (§3) but nothing in `RenameWorkspace.tsx`/`MatchTableContainer.tsx`
  subscribes to `/topic/rename/progress` to render a live per-file progress indicator — the UI
  currently just shows a spinner/disabled state until the whole synchronous request returns
  (see spec 00 §5 for why this is a single blocking HTTP call, not a background job).
