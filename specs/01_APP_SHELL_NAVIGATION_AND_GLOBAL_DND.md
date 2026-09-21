# App Shell, Navigation & Global Drag-and-Drop Specification

**Status:** As-built. Describes `frontend/src/components/AppShell.tsx`,
`SidebarNav.tsx`, `GlobalDropZone.tsx`, `ListPanelPlaceholder.tsx`,
`frontend/src/utils/fileUtils.ts`, the backend `AppShellController`/`AppShellService`, and the
`desktop-wrapper/` Electron IPC surface that App Shell owns. See spec 00 for the
domain enums (`WorkspaceTab`) and shared architecture context referenced throughout.

---

## 1. Sidebar Navigation

`SidebarNav.tsx` renders one button per `WorkspaceTab`, in this fixed order, each switching
`AppShell.tsx`'s `activeTab` state on click:

| Tab id | Label | Icon | Renders |
|---|---|---|---|
| `RENAME` | Rename | `FolderEdit` | `RenameWorkspace` (spec 02) |
| `ANALYZE` | Filter | `Filter` | `AnalyzePanel` (spec 07) |
| `EPISODES` | Episodes | `Globe` | `EpisodesExplorerPanel` (spec 04) |
| `SUBTITLES` | Subtitles | `FileText` | `SubtitlePanel` (spec 05) |
| `SFV` | SFV | `FileCheck` | `SfvPanel` (spec 06) |
| `LIST` | List | `ListOrdered` | `ListPanelPlaceholder` — **not implemented**, see §6 |
| `HISTORY` | History | `History` | `HistoryPanel` (spec 08) |

A separate always-visible "Settings" button (bottom of the sidebar, not part of `WorkspaceTab`)
sets `activeTab` to the literal string `'SETTINGS'`, rendering `SettingsPanel` (spec 09) — this
is a special case handled entirely in `AppShell.tsx`, not a `WorkspaceTab` enum value.

**Corrected labeling:** `LIST` and `HISTORY` are two distinct, correctly-labeled tabs today.
Previously the sidebar button labeled "List" rendered the History/rollback panel by mistake
(a copy-paste-era bug, not a design choice) — that is fixed. `LIST` now renders its own
placeholder component rather than silently aliasing to History.

### Drag-hover-to-preview-switch

Each sidebar tab button has `onDragEnter`/`onDragOver`/`onDragLeave`/`onDrop` handlers
(`SidebarNav.tsx`): dragging a file over a *different* tab for 400ms switches `activeTab` to
it (`window.setTimeout` in `handleTabDragEnter`, cancelled by `handleTabDragLeave` if the
pointer leaves before the timer fires). This mirrors legacy Swing's tab-hover-preview
behavior on `MainFrame`'s panel selector. Dropping the file still requires releasing over
`GlobalDropZone` (see §2) — the hover-switch and the drop handling are independent listeners.

### Keyboard shortcuts (`AppShell.tsx`)

- **Ctrl/Cmd+1 .. Ctrl/Cmd+7** — jump directly to a tab, indexed into the fixed order
  `['RENAME','ANALYZE','EPISODES','SUBTITLES','SFV','LIST','HISTORY']` (`TAB_ORDER` constant).
  Note this order does not match the sidebar's visual top-to-bottom order exactly for the
  index-vs-label mapping purposes — it's simply a flat array indexed by digit minus one.
- **Ctrl/Cmd+Shift+D** — toggles the Dev Logs modal (`DevLogsModal.tsx`; not covered further by
  this spec — it's a standalone request/response/WebSocket-frame log viewer with no backend
  contract of its own beyond what it observes passing through Axios/STOMP).

---

## 2. Global Drag-and-Drop → File Intake Pipeline

`GlobalDropZone.tsx` wraps the entire active-tab content area (inside `AppShell.tsx`) and
tracks a `dragCounter` ref to correctly show/hide a full-panel "Drop files anywhere" overlay
across nested child drag events (a raw `dragenter`/`dragleave` pair fires per descendant
element, so a naive boolean flag flickers — the counter pattern avoids that). On drop, it
resolves each dropped `File` to an absolute path via `getFilePaths()`
(`frontend/src/utils/fileUtils.ts`, see §5) and calls `onFilesDropped(paths)`, which
`AppShell.tsx` wires to `handleFilesDropped`.

### `handleFilesDropped` (`AppShell.tsx`)

```ts
appApi.intakeFiles(paths, activeTab)
  .then((res) => setDroppedFiles((prev) => [...prev, ...res.acceptedFiles.map(f => f.path)]))
  .catch(() => setDroppedFiles((prev) => [...prev, ...paths])); // fall back to raw paths
```

The backend's validated/expanded response is what actually populates `droppedFiles` state
(passed down to whichever panel is active as its `files` prop) — the raw drag-event paths are
only a fallback if the backend call fails outright, not the primary source. This matters
because of what the backend intake endpoint actually does:

### `POST /api/v1/app/intake` (`AppShellController` → `AppShellServiceImpl`)

```java
public record IntakeRequestDto(
    List<String> paths, boolean recursive, boolean filterHidden, WorkspaceTab targetWorkspace)
    implements Serializable {}

public record IntakeResultDto(List<MediaFileDto> acceptedFiles, int rejectedCount)
    implements Serializable {}
```

`appApi.intakeFiles(paths, targetWorkspace)` always sends `recursive: true, filterHidden: true`
today (the frontend has no UI toggle for these — they're effectively fixed defaults, not
user-configurable, despite the DTO carrying them as booleans).

`AppShellServiceImpl.processFileIntake()` behavior, per input path:

1. If the path doesn't exist on disk → `rejectedCount++`, skip.
2. If it's a directory **and** `recursive` is true → real recursive walk via
   `net.filebot.util.FileUtilities.listFiles(file, filter)`, where `filter` is
   `f -> f.isFile() && (!filterHidden || !isHiddenOrJunk(f))`. Every matching file underneath
   (at any depth) is added as an accepted `MediaFileDto` — the directory entry itself is not
   included, only its contents.
3. Otherwise (a plain file, or a directory with `recursive=false`) → accepted directly unless
   `filterHidden` is true and `isHiddenOrJunk(file)`, in which case it's rejected.

`isHiddenOrJunk(file)` = `file.isHidden() || FileUtilities.isThumbnailStore(file)` — the latter
excludes `Thumbs.db`/`.DS_Store` by name (legacy's exact junk-file exclusion, reused directly
rather than reimplemented). **Known limitation:** `FileUtilities.listFiles`'s internal
directory-traversal step always skips OS-hidden *directories* regardless of the `filterHidden`
flag (that filtering happens one level below where this service's `filterHidden` check is
applied) — so a hidden subfolder's contents are never reachable via recursive intake even when
`filterHidden=false`. This is a minor, accepted deviation from a hypothetical "show everything"
mode; no caller currently sets `filterHidden=false` in practice.

Each accepted file becomes a `MediaFileDto` with a fresh random `id` (`UUID.randomUUID()`),
absolute `path`/`parentPath`, `extension` (substring after the last `.`), real `size` and
`lastModified`, `isDirectory=false` (only files are ever accepted — directories are always
either recursed into or rejected as-is), `checksum=null`, and `xattrs=Map.of()` (this endpoint
never populates xattrs — that only happens via the dedicated Analyze endpoint, spec 07 §3).

`targetWorkspace` is accepted by the DTO and sent by every caller, but **`AppShellServiceImpl`
never reads it** — intake behavior is identical regardless of which tab triggered it. It exists
for a hypothetical future per-workspace intake policy (e.g. Subtitles might only want video
files) that has not been built.

---

## 3. Notifications Banner

`AppShell.tsx` subscribes to `/topic/notifications` on mount via `websocketClient.subscribe`
and renders a dismissible top banner (red for `ERROR`/`WARNING` level, green otherwise) for any
`AppNotificationDto` frame received. The subscription and rendering path are real and wired
correctly — **but as of this writing, `TaskProgressPublisher.publishNotification(...)` is never
called from anywhere else in the backend** (`RenameWorkspaceServiceImpl`,
`ChecksumServiceImpl`, `HistoryServiceImpl`, and every other service currently report
success/failure only through their synchronous REST response, not through this channel). The
transport and the frontend consumer are both real; there is simply no producer wired up yet.
Wiring a service to call `publishNotification` for, say, a background warning that has no
natural home in a REST response is a small, additive change — inject `TaskProgressPublisher`
into the service the same way `RenameWorkspaceServiceImpl` and `ChecksumServiceImpl` already
do for their progress topics.

The one notification banner that *does* populate today is purely client-side: `handleGlobalUndo`
(triggered by the sidebar's "Undo" button) sets `notification` state directly from the result
of `historyApi.rollbackTransaction(...)`, with no WebSocket involvement.

---

## 4. Format Expression Bootstrapping

On mount, `AppShell.tsx` calls `settingsApi.getSettings()` and seeds `formatExpression` state
from `settings.tvFormat` if present (falling back to the hardcoded default
`'{n} - {s00e00} - {t}'` otherwise). This is the one and only place the app currently reads a
persisted format preset into the live Rename workspace at startup — see spec 09 §3 for the
full settings contract and spec 02 §5 for how per-mode Preset objects (a separate, richer
mechanism than this single startup default) are applied afterward.

---

## 5. Electron IPC Surface (`desktop-wrapper/`)

App Shell owns the one native-integration contract every panel depends on:
`window.electronAPI`, exposed by `desktop-wrapper/preload.js` via `contextBridge` (context
isolation is on, `nodeIntegration` is off — the renderer never gets direct Node access).

```js
// desktop-wrapper/preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  getPath: (file) => webUtils.getPathForFile(file),               // sync
  revealInFolder: (filePath) => ipcRenderer.invoke('reveal-in-folder', filePath),  // async
  moveToTrash: (filePath) => ipcRenderer.invoke('move-to-trash', filePath)          // async
});
```

```js
// desktop-wrapper/main.js
ipcMain.handle('reveal-in-folder', (event, filePath) => { shell.showItemInFolder(filePath); ... });
ipcMain.handle('move-to-trash', async (event, filePath) => { await shell.trashItem(filePath); ... });
```

`revealInFolder`/`moveToTrash` return `{ success: boolean, error?: string }` (never throw across
the IPC boundary) so callers can show a status message either way.

**Frontend usage contract** (`frontend/src/utils/fileUtils.ts`):

```ts
getFilePath(file: File): string          // sync, Electron-or-browser-fallback path resolution
getFilePaths(files: File[] | FileList): string[]
revealInFileManager(filePath: string, revealFolder?: boolean): Promise<{success, error?}>
moveToTrash(filePath: string): Promise<{success, error?}>
```

Every file-intake point in the app (`<input type="file">` change handlers, `GlobalDropZone`'s
drop handler) must resolve paths via `getFilePath`/`getFilePaths` rather than reading
`(file as any).path` directly, because Electron 30+ removed direct `File.path` access from DOM
events — `webUtils.getPathForFile` is the only supported replacement, and it's only available
inside the preload bridge, hence the `window.electronAPI` indirection. In a plain browser
(`window.electronAPI` undefined), `getFilePath` falls back to `file.name` (no real path
available — browsers sandbox this by design) and `revealInFileManager`/`moveToTrash` resolve
to `{ success: false, error: 'Not available outside the desktop app.' }`.

**Consumers today:** `MatchTableContainer.tsx` (double-click an Original Files row to reveal it
— spec 02 §7) and `AnalyzePanel.tsx`'s context menu ("Reveal" / "Reveal Folder" / "Move to
Trash" — spec 07 §6).

---

## 6. Known Gaps / Deliberately Deferred

- **The real List / sequence-generator tool is unbuilt.** `ListPanelPlaceholder.tsx` is a
  static "not yet implemented" message — legacy's `net.filebot.ui.list.ListPanel` (a
  Groovy-format-driven sequence generator with From/To range spinners, Load/Save, and a
  "Send to" context menu — functionally unrelated to rename history) has no backend service,
  no controller, and no real frontend component yet. This needs its own spec document (e.g. a
  future `11_LIST_PANEL_AND_SEQUENCE_GENERATOR.md`) written before implementation starts —
  nothing in this spec set should be read as already covering it.
- **GroovyPad (F5 REPL) was never ported.** Legacy exposes an interactive Groovy REPL with full
  JVM access via F5. Porting it as-is to a networked Spring Boot backend is a materially larger
  RCE surface than a local desktop process ever was. This is an open product decision (port
  sandboxed vs. drop entirely), not an oversight — do not add an unauthenticated
  code-execution endpoint without an explicit decision to do so.
- **Clipboard Ctrl+V import is unconfirmed to exist in legacy at all.** Legacy's
  `DefaultClipboardHandler` only implements copy-out (Ctrl+C); no dedicated paste-import
  handler was found in the audited legacy source. If this behavior exists at all in the real
  running legacy app, it would be an emergent side effect of Swing's default
  `TransferHandler` paste binding, not a deliberate feature. Verify against the actual legacy
  app before building anything for it.
- **No Getting-Started onboarding flow or Help menu.** Legacy's first-run onboarding
  (`GettingStartedStage`, a JavaFX `WebView` island inside the otherwise-Swing app) and its
  Help menu (Getting Started/FAQ/Forums/Discord/Report Bugs) have no equivalent here. Low
  priority; add if/when onboarding UX becomes a priority.
- **No `X-App-Token` / localhost-only enforcement** — see spec 00 §6 item 4. Not an App Shell
  concern specifically, but worth knowing before assuming any request to `/api/v1/app/**` is
  authenticated.
