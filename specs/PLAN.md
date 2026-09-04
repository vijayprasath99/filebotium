# Swing to Spring Boot + React Migration Implementation Plan & Task Breakdown

## Executive Summary
This document provides a detailed, phase-by-phase execution plan for refactoring the FileBot Java Swing desktop codebase into a decoupled, headless Spring Boot 3 backend and React 18 frontend. Subsequent engineering agents or developers should follow this document sequentially to achieve the migration defined in `specs/00` through `specs/10`.

---

## Migration Philosophy & Directives
1. **Preserve Domain Core:** Retain existing business logic, tokenization, Levenshtein similarity metrics (`net.filebot.similarity.*`), format compilers (`net.filebot.format.*`), scraper clients (`net.filebot.web.*`), and checksum utilities (`net.filebot.hash.*`).
2. **Synthetic / Integration Testing First:** Before modifying or wrapping domain classes, write comprehensive synthetic integration tests (`MockMvc` tests, service layer unit/integration tests) to lock down expected behavior.
3. **Decouple UI:** Extract domain logic out of Swing component event listeners (`ActionListener`, `DocumentListener`, `TransferHandler`) into headless `@Service` classes before deleting Swing UI code (`net.filebot.ui.*`).
4. **Strong Typing via Enums:** Enforce strongly typed Java `enum` and TypeScript `enum` models across all REST DTOs, WebSocket event payloads, and service methods.

---

## Phase 1: Foundation, Domain Models & Synthetic Integration Testing

### Task 1.1: Project Dependencies & Package Structure Setup
- **Target Files:** `build.gradle`, `src/main/java/net/filebot/backend/`
- **Actions:**
  1. Add Spring Boot 3 dependencies (`spring-boot-starter-web`, `spring-boot-starter-websocket`, `spring-boot-starter-validation`, `spring-boot-starter-test`).
  2. Create package structure under `net.filebot.backend`:
     - `net.filebot.backend.domain` (Enums)
     - `net.filebot.backend.dto` (Java Records)
     - `net.filebot.backend.service` (Service Interfaces & Implementations)
     - `net.filebot.backend.controller` (REST Controllers)
     - `net.filebot.backend.websocket` (STOMP WebSocket Handlers)

### Task 1.2: Create Shared Domain Enums
- **Target Files:** `src/main/java/net/filebot/backend/domain/*.java`
- **Actions:**
  - Create Java enums as specified in `specs/00_SYSTEM_ARCHITECTURE_AND_MODELS.md`:
    - `ProviderType` (`THE_TVDB`, `THE_MOVIE_DB`, `ANI_DB`, `TV_MAZE`, `OMDB`, `ACOUSTID`, `OPEN_SUBTITLES`, `SHOOTER`)
    - `MatchingMode` (`TV`, `MOVIE`, `MUSIC`, `ANIME`, `AUTO`)
    - `FileAction` (`MOVE`, `COPY`, `HARDLINK`, `SYMLINK`)
    - `ConflictStrategy` (`OVERWRITE`, `FAIL`, `SKIP`, `AUTO_RENAME`)
    - `MatchStatus` (`MATCHED`, `CONFLICT`, `MANUAL`, `PENDING`, `EXCLUDED`)
    - `HistoryStatus` (`COMPLETED`, `ROLLED_BACK`, `FAILED`)
    - `HashType` (`CRC32`, `MD5`, `SHA_1`, `SHA_256`, `OPENSUBTITLES`)
    - `ChecksumStatus` (`OK`, `MISMATCH`, `MISSING`, `ERROR`, `COMPUTING`)
    - `SubtitleProviderType` (`OPEN_SUBTITLES`, `SHOOTER`)
    - `SubtitleFormat` (`SRT`, `SUB`, `ASS`, `VTT`)
    - `NotificationLevel` (`INFO`, `WARNING`, `ERROR`, `SUCCESS`)
    - `WorkspaceTab` (`RENAME`, `EPISODES`, `SUBTITLES`, `SFV`, `ANALYZE`, `LIST`)
    - `LanguageCode` (`EN`, `DE`, `FR`, `ES`, `IT`, `JA`, `ZH`, `KO`, `RU`, `PT`, `NL`, `SV`, `NO`, `DA`, `FI`, `PL`)
    - `EpisodeSortOrder` (`AIR_DATE`, `ABSOLUTE`, `DVD`)
    - `BindingCategory` (`GENERAL`, `VIDEO`, `AUDIO`, `SERIES`, `MOVIE`)
    - `AnalysisTool` (`MEDIAINFO`, `XATTR`, `TYPES`, `EXTRACT`, `SPLIT`)

### Task 1.3: Create DTO Java Records
- **Target Files:** `src/main/java/net/filebot/backend/dto/*.java`
- **Actions:**
  - Implement all DTO records specified in `specs/00` through `specs/10`:
    - `MediaFileDto`, `EpisodeDto`, `MovieDto`, `MatchDto`, `HistoryElementDto`, `HistoryTransactionDto`, `SubtitleDescriptorDto`, `ChecksumEntryDto`, `SystemStatusDto`, `IntakeRequestDto`, `MatchRequestDto`, `RenameExecutionRequestDto`, `FormatEvaluationRequestDto`, `BindingDocumentationDto`, `SeriesSearchRequestDto`, `EpisodeFetchRequestDto`, `SubtitleSearchRequestDto`, `SubtitleDownloadRequestDto`, `ChecksumVerificationRequestDto`, `MediaInfoInspectorDto`, `AppSettingsDto`, `ProviderCredentialDto`.

### Task 1.4: Synthetic & Integration Test Suite Initialization
- **Target Files:** `src/test/java/net/filebot/backend/`
- **Actions:**
  1. Create synthetic integration tests testing legacy matching behavior (`EpisodeMatcherTest`, `MovieMatcherTest`, `SeasonEpisodeMatcherTest`).
  2. Create synthetic tests for Groovy format evaluation (`ExpressionFormatTest`).
  3. Create synthetic tests for OpenSubtitles hash math (`OpenSubtitlesHasherTest`).
  4. Create synthetic tests for SFV checksum verification (`VerificationFileReaderWriterTest`).
  5. Create synthetic tests for history rollback operations (`HistoryRollbackIntegrationTest`).

---

## Phase 2: Headless Service Layer Implementation

### Task 2.1: Rename Workspace & Matching Service
- **Target Files:** `src/main/java/net/filebot/backend/service/RenameWorkspaceService.java`, `RenameWorkspaceServiceImpl.java`
- **Actions:**
  - Wrap `net.filebot.similarity.EpisodeMatcher`, `SeasonEpisodeMatcher`, `SeriesNameMatcher`, and `StandardRenameAction`.
  - Implement methods: `autoMatch()`, `updateRowAlignment()`, `applyFormat()`, and `executeRename()`.

### Task 2.2: Groovy Format Expression Engine Service
- **Target Files:** `src/main/java/net/filebot/backend/service/FormatExpressionEngineService.java`, `FormatExpressionEngineServiceImpl.java`
- **Actions:**
  - Wrap `net.filebot.format.ExpressionFormat`, `MediaBindingBean`, and `SecureCompiledScript`.
  - Implement methods: `evaluateExpression()`, `batchEvaluate()`, `getAvailableBindings()`, and `validateExpressionSyntax()`.

### Task 2.3: Episodes Fetcher Service
- **Target Files:** `src/main/java/net/filebot/backend/service/EpisodeFetcherService.java`, `EpisodeFetcherServiceImpl.java`
- **Actions:**
  - Wrap `TheTVDBClient`, `TMDbTVClient`, `AnidbClient`, and `TVMazeClient`.
  - Implement methods: `searchSeries()`, `getEpisodes()`, and `getFormattedEpisodeList()`.

### Task 2.4: Subtitles Search & Downloader Service
- **Target Files:** `src/main/java/net/filebot/backend/service/SubtitleService.java`, `SubtitleServiceImpl.java`
- **Actions:**
  - Wrap `OpenSubtitlesClient`, `OpenSubtitlesHasher`, and `ShooterSubtitles`.
  - Implement methods: `computeOpenSubtitlesHash()`, `searchSubtitles()`, `downloadSubtitles()`, and `uploadSubtitle()`.

### Task 2.5: SFV Verification & Checksum Service
- **Target Files:** `src/main/java/net/filebot/backend/service/ChecksumService.java`, `ChecksumServiceImpl.java`
- **Actions:**
  - Wrap `ChecksumComputationService`, `VerificationFileReader`, and `VerificationFileWriter`.
  - Implement methods: `startVerificationTask()`, `cancelVerificationTask()`, `parseVerificationFile()`, and `generateVerificationFileContent()`.

### Task 2.6: MediaInfo Inspector Service
- **Target Files:** `src/main/java/net/filebot/backend/service/MediaInfoInspectorService.java`, `MediaInfoInspectorServiceImpl.java`
- **Actions:**
  - Wrap native `MediaInfo` library bindings and `MediaCharacteristicsParser`.
  - Implement methods: `inspectFile()` and `batchInspect()`.

### Task 2.7: History & Transaction Rollback Service
- **Target Files:** `src/main/java/net/filebot/backend/service/HistoryService.java`, `HistoryServiceImpl.java`
- **Actions:**
  - Wrap `History` and `HistorySpooler`.
  - Implement methods: `getTransactionHistory()`, `getTransactionById()`, `rollbackTransaction()`, `clearHistory()`, and `exportHistory()`.

### Task 2.8: Settings & Preferences Service
- **Target Files:** `src/main/java/net/filebot/backend/service/SettingsService.java`, `SettingsServiceImpl.java`
- **Actions:**
  - Wrap `FilePreferences` and `PropertyFileBackingStore`.
  - Implement methods: `getAppSettings()`, `updateAppSettings()`, `saveProviderCredentials()`, and `resetToDefaults()`.

---

## Phase 3: REST Controllers & WebSocket Progress Streaming

### Task 3.1: REST Endpoints
- **Target Files:** `src/main/java/net/filebot/backend/controller/*.java`
- **Actions:**
  - Implement controllers with OpenAPI / JSON Schema validation matching `specs/01` to `specs/09`:
    - `AppShellController` (`/api/v1/app`)
    - `RenameWorkspaceController` (`/api/v1/rename`)
    - `FormatController` (`/api/v1/format`)
    - `EpisodeController` (`/api/v1/episodes`)
    - `SubtitleController` (`/api/v1/subtitles`)
    - `SfvController` (`/api/v1/sfv`)
    - `AnalyzeController` (`/api/v1/analyze`)
    - `HistoryController` (`/api/v1/history`)
    - `SettingsController` (`/api/v1/settings`)

### Task 3.2: STOMP Over WebSocket Real-Time Event Pipeline
- **Target Files:** `src/main/java/net/filebot/backend/websocket/WebSocketConfig.java`, `TaskProgressPublisher.java`
- **Actions:**
  - Configure STOMP endpoint at `/ws` with message broker topics:
    - `/topic/rename/progress`
    - `/topic/sfv/progress`
    - `/topic/notifications`

---

## Phase 4: React 18 + TypeScript + Tailwind CSS Frontend Implementation

### Task 4.1: React Application Scaffolding
- **Target Folder:** `frontend/`
- **Actions:**
  - Scaffold React + Vite + TypeScript project.
  - Install Tailwind CSS, TanStack Query, StompJS, Monaco Editor (for Groovy format editing), and Lucide React icons.

### Task 4.2: Frontend Components & Workspace Views
- **Target Files:** `frontend/src/components/*.tsx`
- **Actions:**
  - Implement components according to specs:
    - `AppShell` & `SidebarNav` (`specs/01`)
    - `GlobalDropZone` (`specs/01`)
    - `RenameWorkspace` & `MatchTable` (`specs/02`)
    - `FormatEditorModal` & `BindingPicker` (`specs/03`)
    - `EpisodesExplorerPanel` (`specs/04`)
    - `SubtitlePanel` (`specs/05`)
    - `SfvPanel` (`specs/06`)
    - `AnalyzePanel` (`specs/07`)
    - `HistoryPanel` (`specs/08`)
    - `SettingsPanel` (`specs/09`)

---

## Phase 5: Swing Legacy Cleanup & Desktop Wrapper Packaging

### Task 5.1: Swing Code Cleanup
- **Target Packages:** `src/main/java/net/filebot/ui/`
- **Actions:**
  - Safely deprecate/delete Swing UI classes (`JFrame`, `JPanel`, `JDialog`, `CardLayout`, custom Swing cell renderers and transfer handlers) after verifying all headless service endpoints function cleanly.
  - Retain core domain, format, web, hash, and similarity packages.

### Task 5.2: Desktop Wrapper Packaging
- **Target Folder:** `desktop-wrapper/`
- **Actions:**
  - Configure desktop sidecar runner using Tauri / Electron or `jpackage` as detailed in `specs/10_CROSS_PLATFORM_PACKAGING_GUIDE.md`.
  - Validate native file drop and embedded server lifecycle across Windows, macOS, and Linux.

---

## Task Verification Matrix

| Task ID | Component / Area | Primary Verification Command |
| :--- | :--- | :--- |
| **Phase 1** | Foundation & DTOs | `./gradlew compileJava` |
| **Phase 2** | Service Wrappers | `./gradlew test` |
| **Phase 3** | REST Controllers & WebSockets | `./gradlew test` (MockMvc & STOMP integration) |
| **Phase 4** | React Frontend | `cd frontend && npm run build` |
| **Phase 5** | Swing Cleanup & Packaging | `./gradlew clean build` |
