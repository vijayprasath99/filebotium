# System Architecture & Core Domain Model Specification

**Status:** As-built. This document describes the system as it is actually implemented in
this repository (backend: `src/main/java/net/filebot/backend/**`; frontend: `frontend/src/**`),
not an aspirational target. Where the implementation deliberately simplifies or diverges from
the legacy Swing application, that is called out explicitly with the reason, so a future
contributor (human or AI) can tell "not built yet" apart from "built differently on purpose."

---

## 1. High-Level Architecture

The application decouples the legacy Java Swing desktop UI into a headless **Spring Boot 3
(Java 21)** backend and a **React 18 (TypeScript, Tailwind CSS, Vite)** single-page frontend.
The frontend runs either in a standard browser or packaged inside an **Electron** desktop
wrapper (`desktop-wrapper/`) for native filesystem access on Windows, macOS, and Linux.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|   React 18 SPA (TypeScript, Tailwind CSS)                                         |
|      | REST calls (Axios, frontend/src/api/client.ts)                            |
|      | STOMP over WebSocket (frontend/src/api/websocketClient.ts)                |
+-----------------------------------------------------------------------------------+
                                 HTTP / WS Interface
+-----------------------------------------------------------------------------------+
|                        SPRING BOOT 3 BACKEND (single process)                     |
|   REST Controllers (net.filebot.backend.controller.*, under /api/v1/**)           |
|   STOMP Config + Progress Publisher (net.filebot.backend.websocket.*)             |
|   Service Layer (net.filebot.backend.service.*)                                   |
|     - calls directly into legacy FileBot domain logic (net.filebot.*,             |
|       net.filebot.similarity, net.filebot.web, net.filebot.hash,                  |
|       net.filebot.subtitle, net.filebot.archive, net.filebot.media)               |
|   Persistence: java.util.prefs.Preferences (portable file-backed, see §6),        |
|     net.filebot.HistorySpooler (XML), AES-256-GCM-encrypted credential store      |
+-----------------------------------------------------------------------------------+
```

**Key architectural fact:** there is no separate "domain wrapper" layer distinct from the
service layer — each `@Service` implementation in `net.filebot.backend.service` calls the
real legacy Java classes directly (e.g. `RenameWorkspaceServiceImpl` calls
`net.filebot.similarity.EpisodeMatcher` and `net.filebot.media.MediaDetection` directly;
`ChecksumServiceImpl` calls `net.filebot.hash.VerificationUtilities` directly). This reuse
strategy — porting/calling the legacy Java business logic instead of reimplementing it — is
the reason the backend recovers correct behavior without rewriting matching, hashing, or
subtitle algorithms from scratch. Every area spec (02–09) names the exact legacy classes its
service layer calls.

---

## 2. Domain Enums (`net.filebot.backend.domain`)

```java
public enum ProviderType {
  THE_TVDB, THE_MOVIE_DB, ANI_DB, TV_MAZE, OMDB, ACOUSTID, OPEN_SUBTITLES, SHOOTER
}

public enum MatchingMode {
  TV, MOVIE, MUSIC, ANIME, AUTO
}

public enum FileAction {
  MOVE, COPY, HARDLINK, SYMLINK
}

public enum ConflictStrategy {
  OVERWRITE, FAIL, SKIP, AUTO_RENAME
}
// NOTE: AUTO_RENAME has no confirmed legacy precedent (legacy's ConflictDialog only offers
// skip or trash-and-overwrite) and RenameWorkspaceServiceImpl.executeRename() does not
// currently branch on this field at all - every execution behaves as OVERWRITE regardless of
// what the client sends. Implementing real per-strategy behavior (skip vs overwrite vs a
// counter-suffix scheme for AUTO_RENAME) is an open product decision, not a bug fix - do not
// guess at AUTO_RENAME's semantics without confirming intent first.

public enum MatchStatus {
  MATCHED, CONFLICT, MANUAL, PENDING, EXCLUDED
}

public enum HistoryStatus {
  COMPLETED, ROLLED_BACK, FAILED
}

public enum HashType {
  CRC32, MD5, SHA_1, SHA_256, OPENSUBTITLES
}

public enum ChecksumStatus {
  OK, MISMATCH, MISSING, ERROR, COMPUTING, WARNING
}
// WARNING = the computed hash doesn't match a CRC32 checksum embedded in the filename itself
// (e.g. "Test[49A93C5F].txt"), independent of any loaded verification file. Only ever set when
// hashType == CRC32 and no expected hash was supplied (see spec 06 §4).

public enum SubtitleProviderType {
  OPEN_SUBTITLES, SHOOTER
}

public enum SubtitleSearchStrategy {
  EXACT, FUZZY
}
// EXACT = hash-based lookup (net.filebot.subtitle.SubtitleUtilities.lookupSubtitlesByHash),
// FUZZY = name-based search (...findSubtitlesByName). This is a strategy axis, independent of
// `provider` - see spec 05 §3 for why these used to be (incorrectly) conflated.

public enum SubtitleNamingStrategy {
  ORIGINAL, MATCH_VIDEO, MATCH_VIDEO_ADD_LANGUAGE_TAG
}
// Mirrors legacy net.filebot.subtitle.SubtitleNaming exactly (same 3 values, same semantics).

public enum SubtitleFormat {
  SRT, SUB, ASS, VTT
}

public enum NotificationLevel {
  INFO, WARNING, ERROR, SUCCESS
}

public enum WorkspaceTab {
  RENAME, EPISODES, SUBTITLES, SFV, ANALYZE, LIST, HISTORY
}
// LIST and HISTORY are distinct tabs. Historically the "List" sidebar tab actually rendered
// the History/rollback panel (a labeling bug - see spec 01 §2 and spec 08 §1); this is fixed.
// LIST itself is a placeholder today (ListPanelPlaceholder.tsx) - the real legacy List /
// sequence-generator tool has not been ported (see spec 01 §6 "Known Gaps").

public enum LanguageCode {
  EN, DE, FR, ES, IT, JA, ZH, KO, RU, PT, NL, SV, NO, DA, FI, PL
}

public enum EpisodeSortOrder {
  AIR_DATE, ABSOLUTE, DVD
}

public enum BindingCategory {
  GENERAL, VIDEO, AUDIO, SERIES, MOVIE
}
// Used only by FormatExpressionEngineServiceImpl.getAvailableBindings() (spec 03) to group the
// binding-reference list shown in the Format Editor / Episode Bindings modal.
```

`AnalysisTool` (`MEDIAINFO, XATTR, TYPES, EXTRACT, SPLIT`) also exists in this package but is
currently unreferenced by any controller or service — `AnalyzeController`'s endpoints
(`/analyze/inspect`, `/analyze/archive/entries`, `/analyze/parts`, `/analyze/types`,
`/analyze/attributes`) are separate, purpose-built methods rather than being dispatched
through this enum. Treat it as dead code unless a future refactor unifies the Analyze
endpoints around it.

**Frontend mirror:** every enum above has a matching TypeScript string-literal union in
`frontend/src/types/index.ts`, kept in sync by hand (there is no codegen step). When adding or
changing a backend enum, update both sides.

---

## 3. Core DTOs (`net.filebot.backend.dto`)

This is not an exhaustive field-by-field listing (each area spec documents its own DTOs in
full) — this section covers the shared/foundational models referenced across multiple areas.

### 3.1 MediaFileDto — a file on disk

```java
public record MediaFileDto(
    String id, String path, String name, String extension, long size,
    Instant lastModified, String parentPath, boolean isDirectory,
    String checksum, Map<String, String> xattrs) implements Serializable {}
```

`xattrs` is populated for real by `AnalyzeServiceImpl.getFileAttributes()`
(`net.filebot.media.XattrMetaInfo`/`MetaAttributes` — real OS extended attributes / FileBot
rename metadata), not hardcoded to an empty map. See spec 07 §3.

### 3.2 IntakeRequestDto / IntakeResultDto — dropped/loaded files

```java
public record IntakeRequestDto(
    List<String> paths, boolean recursive, boolean filterHidden, WorkspaceTab targetWorkspace)
    implements Serializable {}

public record IntakeResultDto(List<MediaFileDto> acceptedFiles, int rejectedCount)
    implements Serializable {}
```

`AppShellServiceImpl.processFileIntake()` honors `recursive` (real directory walk via
`net.filebot.util.FileUtilities.listFiles`) and `filterHidden` (excludes OS-hidden files and
`Thumbs.db`/`.DS_Store` via `FileUtilities.isThumbnailStore`) for real. See spec 01 §3.

### 3.3 MatchDto / MatchRequestDto — Rename workspace matching

```java
public record MatchRequestDto(
    List<String> filePaths, ProviderType provider, MatchingMode mode,
    LanguageCode language, String formatExpression) implements Serializable {}

public record MatchDto(
    String matchId, MediaFileDto sourceFile, Object targetMetadata, double score,
    String formattedName, String formattedPath, boolean isExcluded, MatchStatus status)
    implements Serializable {}
```

`targetMetadata` is intentionally `Object`, not a sealed/typed union — it holds a real
`net.filebot.web.Episode` or `net.filebot.web.Movie` instance (serialized to JSON via
reflection), because `RenameWorkspaceServiceImpl.autoMatch()` performs genuine provider
matching, not a stub. See spec 02 §2 for the full matching pipeline.

### 3.4 History models

```java
public record HistoryElementDto(
    String sourcePath, String targetPath, FileAction action, HistoryStatus status)
    implements Serializable {}

public record HistoryTransactionDto(
    String transactionId, Instant timestamp, List<HistoryElementDto> elements)
    implements Serializable {}
```

`transactionId` is a stable ID derived from the underlying `History.Sequence`'s timestamp
(`String.valueOf(sequence.date().getTime())`), not a fresh random UUID per call — so
`GET /api/v1/history/{id}` addresses the same transaction across repeated calls. See spec 08.

### 3.5 Subtitle & Checksum models

```java
public record SubtitleDescriptorDto(
    SubtitleProviderType provider, String id, String name, LanguageCode language,
    SubtitleFormat format, double score, String downloadUrl, String videoFilePath)
    implements Serializable {}

public record ChecksumEntryDto(
    String path, String expectedHash, String calculatedHash, HashType hashType,
    ChecksumStatus status) implements Serializable {}
```

`videoFilePath` on `SubtitleDescriptorDto` lets the frontend correctly attribute a variable
number of real search results per video file (a flat array with positional
`results[i] <-> rows[i]` correspondence is structurally incapable of that) — see spec 05 §2.

### 3.6 Progress & notification events (WebSocket payloads)

```java
public record RenameProgressEventDto(
    String taskId, int processed, int total, String currentFile, double progressPercentage)
    implements Serializable {}

public record ChecksumProgressEventDto(
    String taskId, String currentFilePath, long bytesProcessed, long totalBytes,
    double MBps, double progressPercentage, ChecksumEntryDto completedEntry)
    implements Serializable {}

public record AppNotificationDto(NotificationLevel level, String message, Instant timestamp)
    implements Serializable {}
```

See §5 for how/when these are actually published.

### 3.7 Preset model (Rename workspace presets)

```java
public record PresetDto(
    String name, String formatExpression, ProviderType provider, MatchingMode mode,
    LanguageCode language, FileAction action) implements Serializable {}
```

Persisted via Jackson JSON under the `Preferences` node
`Preferences.userNodeForPackage(net.filebot.ui.rename.RenamePanel.class).node("presets")` —
co-located with (but not wire-compatible with) legacy's own preset storage; see spec 02 §5 for
why legacy's `net.filebot.ui.rename.Preset` class could not be reused directly for
serialization (it has no no-arg constructor and the bundled json-io 4.14.1 cannot instantiate
it reflectively — confirmed by a failing round-trip test during implementation).

### 3.8 Analyze-panel models

```java
public record ArchiveEntryDto(String name, String path, long size) implements Serializable {}

public record FileGroupDto(String name, List<String> files, long totalSizeBytes)
    implements Serializable {}
```

Used by the Archives/Parts/Types tabs — see spec 07 §2–§4.

---

## 4. REST + WebSocket Communication Model

- **REST** (`/api/v1/**`): synchronous request/response for everything — including operations
  that in legacy ran on a background thread with a progress dialog (batch rename, batch
  hashing). See §5 for why these are synchronous here rather than backed by a task queue.
- **STOMP over WebSocket** (`/ws` and `/api/ws`, configured in
  `net.filebot.backend.websocket.WebSocketConfig`): used for progress event fan-out, published
  *during* a synchronous REST request's per-file loop (not as a substitute for the REST
  response). Topics: `/topic/rename/progress`, `/topic/sfv/progress`, `/topic/notifications`.
- There is **no Server-Sent-Events endpoint**. An earlier draft of this spec described one
  (`/api/v1/events/stream`); it was never built and nothing in the frontend expects it — this
  is a corrected omission, not a removed feature.

---

## 5. Progress Publishing & Concurrency Model (as built)

`net.filebot.backend.websocket.TaskProgressPublisher` is a `@Component` holding an injected
`SimpMessagingTemplate`. Its `publishRenameProgress(...)` / `publishSfvProgress(...)` /
`publishNotification(...)` methods call `template.convertAndSend(topic, dto)` for real. It is
injected into `RenameWorkspaceServiceImpl` and `ChecksumServiceImpl`, which call it once per
file inside their rename/hashing loops — so a client subscribed to `/topic/rename/progress` or
`/topic/sfv/progress` while a batch operation is in flight receives one frame per file, in real
time, before the REST call itself returns.

**Important limitation, by design, not oversight:** there is no `@EnableAsync` /
`ThreadPoolTaskExecutor` / background task queue anywhere in the backend. Batch rename and
batch checksum verification both run **synchronously on the request-handling thread** — the
HTTP client's connection stays open for the full duration of the batch, and WebSocket progress
frames are a bonus real-time channel alongside that same blocking call, not an alternative to
it. `ChecksumService.cancelVerificationTask(taskId)` is consequently a documented no-op: by
the time a cancel request could arrive, the synchronous call that owns `taskId` has almost
always already returned. A prior draft of this spec described dedicated `matchingExecutor`/
`hashingExecutor` Spring beans; those were never implemented and are not planned unless a
future contributor decides genuine background/cancellable batch processing is worth the
added complexity (task registry, cancellation tokens, client-side polling or reconnect
semantics).

---

## 6. Persistence & Security (as built)

1. **Preferences.** `FileBotBackendApplication`'s static initializer installs
   `net.filebot.util.prefs.FilePreferencesFactory` (via the
   `java.util.prefs.PreferencesFactory` system property) **before** any `Preferences` node is
   touched, so `java.util.prefs.Preferences` reads/writes a portable flat file at
   `~/.filebot/prefs.properties` instead of the Windows Registry / macOS plist / Linux XML
   store. Rename-related settings (format expressions, language, presets) are stored under
   `Preferences.userNodeForPackage(net.filebot.ui.rename.RenamePanel.class)` — the same node
   legacy's own `RenamePanel` uses — so an existing legacy user's preferences surface
   correctly in the new Settings screen. See spec 09 §2.
2. **History.** `net.filebot.HistorySpooler` (legacy, reused verbatim) appends real rename
   transactions and persists them as `~/.filebot/history.xml` on JVM shutdown / commit. See
   spec 08.
3. **Provider credentials.** `SettingsServiceImpl` encrypts API keys/usernames/passwords with
   AES-256-GCM before storing them in `Preferences`, using a locally-generated key file at
   `~/.filebot/credentials.key` (owner-only file permissions, best-effort cross-platform).
   This is a backend-only mitigation, not OS-keychain-backed — see spec 09 §4 for why (a
   `safeStorage`-based Electron-side design was considered but the Java backend has no way to
   call into Electron's main-process API from a plain Spring service).
4. **No local auth token / localhost-only binding is implemented.** An earlier draft of this
   spec described a transient `X-App-Token` header and strict `127.0.0.1` binding; neither
   exists in the current `application.properties`/Spring Security configuration (there is no
   Spring Security dependency at all). The backend currently trusts any client that can reach
   its port. This is acceptable for the current "Electron spawns a local child process"
   deployment model but would need real auth before ever being exposed beyond localhost.

---

## 7. Reading the Rest of This Spec Set

Specs 01–09 each cover one functional area (App Shell/Navigation, Rename Workspace, Format
Expression Engine, Episodes, Subtitles, SFV, Analyze, History, Settings) and follow the same
structure: **what the UI does**, **the exact REST/WebSocket contract**, **which legacy Java
classes the service layer calls (if any) and how**, and **known gaps / deliberately deferred
work**, so that implementing or modifying a feature never requires guessing at intent from the
UI screenshots alone. Spec 10 covers Electron/cross-platform packaging and is largely
independent of the others.
