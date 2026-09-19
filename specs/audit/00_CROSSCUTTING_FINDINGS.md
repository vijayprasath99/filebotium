# Cross-Cutting Findings

These issues recur across multiple feature areas. Each area-specific audit file
cites back to this document instead of re-deriving the same evidence. Read this
file first.

---

## X1. The entire WebSocket progress-publishing pipeline is dead code

**File:** `src/main/java/net/filebot/backend/websocket/TaskProgressPublisher.java`

```java
public class TaskProgressPublisher {
  private final List<Object> publishedEvents = new ArrayList<>();

  public void publishRenameProgress(String taskId, int processed, int total, String currentFile, double percentage) {
    publishedEvents.add(taskId + ":" + processed + "/" + total + ":" + currentFile);
  }

  public void publishSfvProgress(ChecksumProgressEventDto progressEvent) {
    if (progressEvent != null) {
      publishedEvents.add(progressEvent);
    }
  }

  public List<Object> getPublishedEvents() {
    return publishedEvents;
  }
}
```

- It does not autowire or call `SimpMessagingTemplate` / `SimpMessagingTemplate.convertAndSend(...)`.
- A repo-wide grep for `convertAndSend`, `SimpMessagingTemplate`, `TaskProgressPublisher`,
  `publishRenameProgress`, `publishSfvProgress` across `src/main/java/net/filebot/backend`
  found **zero callers anywhere** — the class is only referenced by its own definition.
- `WebSocketConfig.java` correctly registers a STOMP broker (`/topic`, endpoint `/ws` and
  `/api/ws`), so the transport itself works.
- `frontend/src/api/websocketClient.ts` connects and auto-subscribes to
  `/topic/rename/progress`, `/topic/sfv/progress`, `/topic/notifications`
  (`ensureDefaultSubscriptions()`), and `DevLogsModal.tsx` will happily display any
  inbound WS frame — but nothing server-side ever publishes to those topics, so these
  subscriptions never receive a message under any code path in the current backend.

**Net effect:** every real-time progress UI described in specs/00, specs/02, specs/06
(batch rename progress bar, SFV hashing speed gauge/ETA/progress bar, generic app
notifications banner) is **non-functional by construction**, independent of whatever
each React panel's local state machine does. Batch operations can only ever appear as
"nothing happening" followed by an abrupt jump to a final REST response.

**Severity:** BROKEN_FUNCTIONALITY (architecture-level, affects specs 00/02/06 directly,
and indirectly 05 if any batch subtitle download depends on progress feedback).

**Fix direction:** Inject `SimpMessagingTemplate` into `TaskProgressPublisher`. Change
`publishRenameProgress`/`publishSfvProgress` to call
`template.convertAndSend(WebSocketConfig.TOPIC_RENAME_PROGRESS, ...)` /
`template.convertAndSend(WebSocketConfig.TOPIC_SFV_PROGRESS, ...)`, construct real DTOs
matching the payload schemas in specs/02 and specs/06, and call the publisher from
inside the actual long-running loops in `RenameWorkspaceServiceImpl.executeRename(...)`
and `ChecksumServiceImpl.startVerificationTask(...)` (per-file, not just at completion).
Also add a genuine publisher call for `/topic/notifications` (currently nothing anywhere
in the backend ever sends an `AppNotificationDto`, so the notification banner concept in
specs/00 and specs/01 Section C has no producer at all).

---

## X2. File intake silently drops recursion, hidden-file filtering, and rejection reporting — and the frontend ignores the response anyway

**Backend:** `src/main/java/net/filebot/backend/controller/AppShellController.java:35-60`

```java
@PostMapping("/intake")
public List<MediaFileDto> processFileIntake(@RequestBody IntakeRequestDto request) {
  ...
  for (String path : request.paths()) {
    File file = new File(path);
    if (file.exists()) {
      accepted.add(new MediaFileDto(...));
    }
  }
  return accepted;
}
```

- `IntakeRequestDto.recursive` and `IntakeRequestDto.filterHidden` are declared in the
  DTO and sent by the frontend (`frontend/src/api/client.ts:108-111`,
  `appApi.intakeFiles` always sends `recursive: true, filterHidden: true`) but are
  **never read** by the controller. Directories are added to the result as-is
  (`isDirectory: file.isDirectory()`) with no recursive expansion into child files.
- There is no `AppShellService` interface/impl anywhere in
  `src/main/java/net/filebot/backend/service/` despite specs/01 Section B specifying one
  — the controller inlines all logic itself. Confirmed via directory listing of that
  package (no `AppShellService*.java` present).
- No hidden/system file filtering (`.DS_Store`, `Thumbs.db`, `desktop.ini`) exists
  anywhere in the controller, unlike the legacy `DefaultTransferHandler`
  (`src/main/java/net/filebot/ui/transfer/DefaultTransferHandler.java`) /
  `FileTransferablePolicy` pipeline described in specs/01 Section A.
- The response shape doesn't match specs/01's documented schema
  (`{ acceptedFiles: [...], rejectedCount: N }`) — it just returns the raw array. This
  is self-consistent with the frontend's expectation (`MediaFile[]`), so it isn't a
  wire-format bug per se, but it means "rejected file" reporting (spec Section D,
  "Invalid File System Paths Prompt") has **no data channel to ever exist on.**

**Frontend:** `frontend/src/components/AppShell.tsx:72-80`

```tsx
const handleFilesDropped = useCallback(
  (paths: string[]) => {
    appApi.intakeFiles(paths, activeTab).catch((err) => {
      console.warn('Failed to register dropped files with backend:', err);
    });
    setDroppedFiles((prev) => [...prev, ...paths]);
  },
  [activeTab]
);
```

The backend call's **resolved value is discarded** — there is no `.then(...)` branch.
`droppedFiles` is populated straight from the raw OS drag-event paths, not from
whatever the backend validated, expanded, or rejected. So even if X2's backend gaps
were fixed today, the frontend would still never use the corrected response.

**Combined effect:** dropping a folder never recursively expands to its contained
media files in either layer; hidden/system files are never filtered; a dropped path
that doesn't exist or can't be read is silently ignored with zero user-facing
indication (spec Section D's "Invalid File System Paths Prompt" cannot ever fire).

**Severity:** BROKEN_FUNCTIONALITY (directly breaks the "drop a season folder" and
"drop a movie library root" golden-path workflows explicitly called out in specs/01).

---

## X3. "List" sidebar tab is mislabeled and shows History, not the legacy List panel

See `specs/audit/01_appshell_and_navigation_audit.md` Gap AS-1/AS-2 and
`specs/audit/08_history_and_list_audit.md` for full detail. Summary: the legacy
`net.filebot.ui.list.ListPanel` (a Groovy-pattern-driven sequence/list generator with
its own drag-drop, Load/Save, and "Send to" context menu) has zero React
implementation, while `frontend/src/components/AppShell.tsx:167` renders
`HistoryPanel` under the `'LIST'` tab id, and `SidebarNav.tsx:31` labels that tab
"List" with a `Wand2` icon. There is no sidebar entry, menu item, or label anywhere
in the React app that says "History".

**Severity:** BROKEN_FUNCTIONALITY (History/rollback is a documented, data-integrity-
critical feature per specs/08 that is only reachable by accident; the real List panel
feature is 100% absent).
