# App Shell, Navigation & Global Drag-and-Drop Specification

## Section A: Legacy Codebase Analysis

### Source Files Audited
- `src/main/java/net/filebot/ui/MainFrame.java`
- `src/main/java/net/filebot/ui/PanelBuilder.java`
- `src/main/java/net/filebot/ui/HeaderPanel.java`
- `src/main/java/net/filebot/ui/FileBotTabComponent.java`
- `src/main/java/net/filebot/ui/FileBotMenuBar.java`
- `src/main/java/net/filebot/ui/SinglePanelFrame.java`
- `src/main/java/net/filebot/ui/NotificationHandler.java`
- `src/main/java/net/filebot/ui/transfer/DefaultTransferHandler.java`
- `src/main/java/net/filebot/ui/transfer/FileTransferablePolicy.java`
- `src/main/java/net/filebot/ui/transfer/ClipboardHandler.java`

### UI Hierarchy & Layout Mechanics
1. **Main Frame (`MainFrame`)**: The root Swing `JFrame` containing:
   - Top Header Panel (`HeaderPanel`): App icon, title, mode banner, and status notification overlay.
   - Side Navigation Bar (`FileBotTab` array within card switching panel): Navigation sidebar switching workspace views (`RenamePanel`, `EpisodeListPanel`, `SubtitlePanel`, `SfvPanel`, `FilterPanel`, `ListPanel`).
   - Central Workspace (`CardLayout` panel): Switches view components based on active tab selection.
   - Menu Bar (`FileBotMenuBar`): Global actions, undo/history triggering, preferences dialog, and support/about links.
2. **Drag-and-Drop Infrastructure (`DefaultTransferHandler`)**:
   - Extends Swing `TransferHandler`.
   - Intercepts system drop events across the entire window frame.
   - Handles `DataFlavor.javaFileListFlavor` and text/uri-list payloads.
   - Delegates file processing to tab-specific `TransferablePolicy` implementations (`FilesListTransferablePolicy`, `SubtitleDropTarget`, `ChecksumTableTransferablePolicy`, `FileTreeTransferablePolicy`).

### Extracted Business Logic & Mechanics
- **File Ingestion:** Recursively expands dropped directories if policy permits, filtering out hidden or system OS files (`.DS_Store`, `Thumbs.db`, `desktop.ini`).
- **Tab Auto-Switching / Routing:** When files are dropped on specific header tabs, the application switches active workspace and routes dropped file paths to that tab's model.
- **Global Clipboard Operations:** Listens for Ctrl+V / Cmd+V globally to parse file paths or raw text from system clipboard via `DefaultClipboardHandler`.

---

## Section B: Target Spring Boot Backend Specification

### Service Interfaces & DTOs

```java
package net.filebot.backend.service;

import net.filebot.backend.domain.NotificationLevel;
import net.filebot.backend.domain.WorkspaceTab;
import net.filebot.backend.dto.MediaFileDto;
import net.filebot.backend.dto.SystemStatusDto;
import java.util.List;

public interface AppShellService {
    SystemStatusDto getSystemStatus();
    List<MediaFileDto> processFileIntake(IntakeRequestDto request);
    void handleClipboardContent(String textContent);
}

public record IntakeRequestDto(
    List<String> paths,
    boolean recursive,
    boolean filterHidden,
    WorkspaceTab targetWorkspace
) {}

public record SystemStatusDto(
    String appName,
    String version,
    String javaVersion,
    String osName,
    String osArch,
    long freeMemoryBytes,
    long totalMemoryBytes
) {}

public record AppNotificationDto(
    String id,
    NotificationLevel level,
    String title,
    String message,
    String timestamp
) {}
```

### REST Endpoints

#### 1. File Intake Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/app/intake`
- **Request JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "paths": { "type": "array", "items": { "type": "string" } },
    "recursive": { "type": "boolean" },
    "filterHidden": { "type": "boolean" },
    "targetWorkspace": { "type": "string", "enum": ["RENAME", "EPISODES", "SUBTITLES", "SFV", "ANALYZE", "LIST"] }
  },
  "required": ["paths"]
}
```
- **Response JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "acceptedFiles": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "path": { "type": "string" },
          "name": { "type": "string" },
          "extension": { "type": "string" },
          "size": { "type": "number" },
          "lastModified": { "type": "string" },
          "isDirectory": { "type": "boolean" }
        }
      }
    },
    "rejectedCount": { "type": "integer" }
  }
}
```
- **Status Codes:** `200 OK`, `400 Bad Request`, `500 Internal Server Error`

#### 2. System Status Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/app/status`
- **Response JSON Schema:** Standard `SystemStatusDto` fields.
- **Status Codes:** `200 OK`

### WebSocket / SSE Events
- **Topic:** `/topic/notifications`
- **Payload Schema:**
```json
{
  "id": "uuid-string",
  "level": "INFO | WARNING | ERROR | SUCCESS",
  "title": "Title String",
  "message": "Detailed message text",
  "timestamp": "ISO-8601 string"
}
```

---

## Section C: Target React Frontend Specification

### Component Architecture

```
AppShell
├── SidebarNav
│   └── NavTabButton (Rename, Episodes, Subtitles, SFV, Analyze, List)
├── HeaderBar
│   ├── AppTitleAndStatus
│   ├── QuickActionsBar (Undo, Clear, Settings)
│   └── SystemHealthIndicator
├── GlobalDropZone (Overlay active when dragging over window)
└── ActiveWorkspaceContainer
    └── [RenameWorkspace | EpisodesExplorer | SubtitlePanel | SfvPanel | AnalyzePanel]
```

### Props & State Types (TypeScript)

```typescript
import { WorkspaceTab, NotificationLevel } from './types';

export interface AppShellState {
  activeTab: WorkspaceTab;
  isDraggingGlobal: boolean;
  notifications: AppNotification[];
  systemStatus: SystemStatus | null;
}

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  timestamp: string;
}

export interface GlobalDropZoneProps {
  onFilesDropped: (files: File[] | string[], targetTab?: WorkspaceTab) => void;
  activeTab: WorkspaceTab;
}
```

### UI & Interaction Behavior
1. **Global Drag-and-Drop:**
   - Overlays a full-screen semi-transparent backdrop (`bg-blue-500/20 backdrop-blur-sm z-50`) with an animated indicator ("Drop Files to Import").
   - Supports dragging native OS files or browser text payloads.
2. **Keyboard Shortcuts:**
   - `Cmd+1` to `Cmd+6` / `Ctrl+1` to `Ctrl+6`: Switch workspace tabs.
   - `Cmd+Z` / `Ctrl+Z`: Trigger global undo.
   - `Cmd+,` / `Ctrl+,`: Open Settings modal.

---

## Section D: Dialogs, Modals & Edge Cases

1. **Unsaved Changes Confirmation Modal:**
   - Triggered when switching tabs while an active operation is executing in the current workspace.
   - Buttons: "Cancel", "Discard & Switch".
2. **Invalid File System Paths Prompt:**
   - Triggered if dragged paths cannot be read due to file permission errors or non-existent network shares.
3. **Clipboard Read Fallback Modal:**
   - Displays raw text editor when clipboard content contains unstructured multiline strings or list data.
4. **Browser Sandbox Isolation vs Desktop Environment:**
   - In standard browsers (e.g., Chrome), HTML5 Drag-and-Drop and File inputs sanitize dropped files to protect host security, exposing only `file.name` and omitting full directory paths.
   - For functional file intake (`POST /api/v1/app/intake`), tests and desktop usage run inside the Electron desktop wrapper (`desktop-wrapper/`). In Electron 30+, `webUtils.getPathForFile(file)` is bridged via `preload.js` and resolved via `frontend/src/utils/fileUtils.ts` to supply full absolute filesystem paths.

---

## AUDIT ADDENDUM (2026-09-19) — DO NOT SILENTLY OVERWRITE ORIGINAL CONTENT ABOVE

Full detail: `specs/audit/01_appshell_and_navigation_audit.md` and
`specs/audit/00_CROSSCUTTING_FINDINGS.md`. Summary of confirmed gaps (IDs match the
audit file):

- **AS-3/AS-4 (BROKEN_FUNCTIONALITY, highest priority in this document):** The
  sidebar's "List" tab (`SidebarNav.tsx`) renders `HistoryPanel` (rollback/undo UI),
  not the real legacy List panel (`net.filebot.ui.list.ListPanel` — a Groovy-pattern
  sequence generator, completely unrelated to history). There is no tab, menu, or
  label anywhere in the app that says "History." **New requirement:** add a real
  React implementation of the legacy List/sequence-generator panel (not currently
  covered by any spec 00-10 — recommend authoring a new `specs/11_LIST_PANEL.md`),
  and give History its own discoverable entry point, restoring "List" to mean List.
- **AS-1/AS-2 (BROKEN_FUNCTIONALITY):** The `/topic/notifications` WebSocket
  channel described in §C has no publisher anywhere in the backend, and no React
  component ever subscribes to it either — see specs/00 addendum §X1.
- **AS-8 (DATA_INTEGRITY_RISK):** §A's "recursively expands dropped directories...
  filtering out hidden or system OS files" is **not implemented**.
  `AppShellController.processFileIntake` reads `recursive`/`filterHidden` into the
  request DTO but never uses them; separately, `AppShell.tsx` discards the intake
  response entirely and populates every workspace from raw, unfiltered drag-event
  paths. **New requirement:** implement real recursive expansion + hidden/system-file
  filtering server-side (reuse the existing filter predicate from
  `net.filebot.ui.transfer.FileTransferablePolicy`/`BackgroundFileTransferablePolicy`
  — do not reinvent it), and make the frontend actually consume the response.
- **AS-5 (needs verification, not a confirmed gap):** this spec's claim that
  `DefaultClipboardHandler` "listens for Ctrl+V... to parse file paths or raw text"
  is not supported by the class's actual contents (it implements only Ctrl+C
  copy-out). Verify against the running legacy app whether any Ctrl+V import
  behavior exists at all before treating this as a requirement to port.
- **AS-9/AS-10/AS-11 (MINOR/COSMETIC):** Getting-Started onboarding, the Help menu
  (FAQ/Forums/Discord/Report Bugs), and the Mac-App-Store review prompt have no React
  equivalents. Recommend explicit "won't port" sign-off for AS-11 (Mac-App-Store-only,
  inapplicable to the documented Electron-only packaging strategy in specs/10) rather
  than treating it as an open gap.
- **AS-7:** `MainFrame`'s `Ctrl+Shift+Delete` (Clear Cache) and `F1` (Help) shortcuts
  have no port; `F5` (GroovyPad Groovy REPL) is flagged as needing an explicit
  product decision before porting or dropping, since it becomes a materially larger
  security exposure once the backend is a networked Spring Boot service rather than
  a local desktop process.
