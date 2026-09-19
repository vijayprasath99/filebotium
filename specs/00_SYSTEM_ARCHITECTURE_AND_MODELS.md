# System Architecture & Core Domain Model Specification

## 1. High-Level Target Architecture

The target architecture for the migrated FileBot application decouples the legacy Java Swing user interface into a headless **Spring Boot 3 (Java 21)** backend service and a **React 18+ (TypeScript, Tailwind CSS)** frontend web application. The frontend can run in standard desktop web browsers or packaged inside the cross-platform desktop wrapper (**Electron**) for Windows, macOS, and Linux.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                       React 18 Desktop / Web SPA                          |   |
|   |               (TypeScript, Tailwind CSS, TanStack Query)                  |   |
|   +---------------------------------------------------------------------------+   |
|      | Drag-and-Drop Handler   | REST API Calls (Axios)   | STOMP Over WebSocket |
|      v                         v                          v                       |
+-----------------------------------------------------------------------------------+
                                 HTTP / WS Interface
+-----------------------------------------------------------------------------------+
|                             SPRING BOOT 3 BACKEND                                 |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                  REST Controllers & STOMP Endpoints                      |   |
|   +---------------------------------------------------------------------------+   |
|   |                            Service Layer                                  |   |
|   |  (Matching, Format Engine, Subtitles, Checksum, MediaInfo, History, Prefs)|   |
|   +---------------------------------------------------------------------------+   |
|   |                          Domain Logic Wrappers                            |   |
|   |    (FileBot Core: net.filebot.similarity, net.filebot.web, net.filebot.hash)  |   |
|   +---------------------------------------------------------------------------+   |
|   |                        Async Event & Task Pipeline                        |   |
|   |               (ThreadPoolTaskExecutor, Spring Event Bus)                  |   |
|   +---------------------------------------------------------------------------+   |
|   |                       Persistence & File Access                           |   |
|   |               (Jackson JSON, XML Spooler, File Preferences)               |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Shared Core Domain Enums

To ensure type safety across the entire API contract and avoid stringly-typed anti-patterns, the following Java Enums and TypeScript Enums/Unions define the domain vocabulary:

```java
package net.filebot.backend.domain;

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
    OK, MISMATCH, MISSING, ERROR, COMPUTING
}

public enum SubtitleProviderType {
    OPEN_SUBTITLES, SHOOTER
}

public enum SubtitleFormat {
    SRT, SUB, ASS, VTT
}

public enum NotificationLevel {
    INFO, WARNING, ERROR, SUCCESS
}

public enum WorkspaceTab {
    RENAME, EPISODES, SUBTITLES, SFV, ANALYZE, LIST
}

public enum LanguageCode {
    EN, DE, FR, ES, IT, JA, ZH, KO, RU, PT, NL, SV, NO, DA, FI, PL
}

public enum EpisodeSortOrder {
    AIR_DATE, ABSOLUTE, DVD
}
```

---

## 3. Core Domain Models & Data Transfer Objects (DTOs)

### 3.1 MediaFile Model
Represents a local disk file inspected or manipulated by the system.

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;

public record MediaFileDto(
    String id,
    String path,
    String name,
    String extension,
    long size,
    Instant lastModified,
    String parentPath,
    boolean isDirectory,
    String checksum,
    Map<String, String> xattrs
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export interface MediaFile {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: string; // ISO 8601 Timestamp
  parentPath: string;
  isDirectory: boolean;
  checksum?: string;
  xattrs: Record<string, string>;
}
```

---

### 3.2 Episode Model
Represents episode metadata fetched from providers (TheTVDB, TMDb, AniDB, TVMaze).

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import java.io.Serializable;
import java.time.LocalDate;

public record EpisodeDto(
    ProviderType provider,
    String seriesName,
    Integer seriesId,
    Integer seasonNumber,
    Integer episodeNumber,
    Integer absoluteNumber,
    String title,
    LocalDate releaseDate,
    LanguageCode language,
    String overview
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export type ProviderType = 'THE_TVDB' | 'THE_MOVIE_DB' | 'ANI_DB' | 'TV_MAZE' | 'OMDB' | 'ACOUSTID' | 'OPEN_SUBTITLES' | 'SHOOTER';
export type LanguageCode = 'EN' | 'DE' | 'FR' | 'ES' | 'IT' | 'JA' | 'ZH' | 'KO' | 'RU' | 'PT' | 'NL' | 'SV' | 'NO' | 'DA' | 'FI' | 'PL';

export interface Episode {
  provider: ProviderType;
  seriesName: string;
  seriesId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteNumber: number | null;
  title: string;
  releaseDate: string | null; // YYYY-MM-DD
  language: LanguageCode;
  overview?: string;
}
```

---

### 3.3 Movie Model
Represents movie metadata fetched from providers (TMDb, OMDb).

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import java.io.Serializable;

public record MovieDto(
    ProviderType provider,
    String title,
    Integer year,
    Integer tmdbId,
    String imdbId,
    LanguageCode language,
    String overview
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export interface Movie {
  provider: ProviderType;
  title: string;
  year: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  language: LanguageCode;
  overview?: string;
}
```

---

### 3.4 Match Model
Pairs a source `MediaFile` with a target metadata object (`Episode`, `Movie`, or `AudioTrack`) and calculated similarity metrics.

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import net.filebot.backend.domain.MatchStatus;
import java.io.Serializable;

public record MatchDto(
    String matchId,
    MediaFileDto sourceFile,
    Object targetMetadata, // EpisodeDto or MovieDto
    double score,
    String formattedName,
    String formattedPath,
    boolean isExcluded,
    MatchStatus status
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export type MatchStatus = 'MATCHED' | 'CONFLICT' | 'MANUAL' | 'PENDING' | 'EXCLUDED';

export interface Match {
  matchId: string;
  sourceFile: MediaFile;
  targetMetadata: Episode | Movie | null;
  score: number;
  formattedName: string;
  formattedPath: string;
  isExcluded: boolean;
  status: MatchStatus;
}
```

---

### 3.5 History & Transaction Models
Logs file operations (`MOVE`, `COPY`, `HARDLINK`, `SYMLINK`) for rollback.

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.HistoryStatus;
import java.io.Serializable;
import java.time.Instant;
import java.util.List;

public record HistoryElementDto(
    String sourcePath,
    String targetPath,
    FileAction action,
    HistoryStatus status
) implements Serializable {}

public record HistoryTransactionDto(
    String transactionId,
    Instant timestamp,
    List<HistoryElementDto> elements
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export type FileAction = 'MOVE' | 'COPY' | 'HARDLINK' | 'SYMLINK';
export type HistoryStatus = 'COMPLETED' | 'ROLLED_BACK' | 'FAILED';

export interface HistoryElement {
  sourcePath: string;
  targetPath: string;
  action: FileAction;
  status: HistoryStatus;
}

export interface HistoryTransaction {
  transactionId: string;
  timestamp: string; // ISO 8601
  elements: HistoryElement[];
}
```

---

### 3.6 Subtitle & Checksum Models

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import net.filebot.backend.domain.ChecksumStatus;
import net.filebot.backend.domain.HashType;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.SubtitleFormat;
import net.filebot.backend.domain.SubtitleProviderType;
import java.io.Serializable;

public record SubtitleDescriptorDto(
    SubtitleProviderType provider,
    String id,
    String name,
    LanguageCode language,
    SubtitleFormat format,
    double score,
    String downloadUrl
) implements Serializable {}

public record ChecksumEntryDto(
    String path,
    String expectedHash,
    String calculatedHash,
    HashType hashType,
    ChecksumStatus status
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export type HashType = 'CRC32' | 'MD5' | 'SHA_1' | 'SHA_256' | 'OPENSUBTITLES';
export type ChecksumStatus = 'OK' | 'MISMATCH' | 'MISSING' | 'ERROR' | 'COMPUTING';
export type SubtitleProviderType = 'OPEN_SUBTITLES' | 'SHOOTER';
export type SubtitleFormat = 'SRT' | 'SUB' | 'ASS' | 'VTT';

export interface SubtitleDescriptor {
  provider: SubtitleProviderType;
  id: string;
  name: string;
  language: LanguageCode;
  format: SubtitleFormat;
  score: number;
  downloadUrl: string;
}

export interface ChecksumEntry {
  path: string;
  expectedHash: string | null;
  calculatedHash: string | null;
  hashType: HashType;
  status: ChecksumStatus;
}
```

---

## 4. Communication Strategy: REST & WebSocket / SSE

- **REST API:** Handles synchronous request/response operations (fetching settings, triggering searches, evaluating single format expressions, initiating file renaming).
- **STOMP over WebSocket (`/ws` endpoint):** Handles real-time progress updates for long-running asynchronous tasks (batch matching, multi-file hash verification, subtitle batch downloading, file batch renaming).
- **Server-Sent Events (SSE `/api/v1/events/stream`):** Serves as an alternative fallback for unidirectional background status updates and global notifications.

---

## 5. Async Event Loop, Thread Pools, and Resource Management

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "matchingExecutor")
    public Executor matchingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("MatcherThread-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "hashingExecutor")
    public Executor hashingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(Runtime.getRuntime().availableProcessors());
        executor.setMaxPoolSize(Runtime.getRuntime().availableProcessors() * 2);
        executor.setQueueCapacity(1000);
        executor.setThreadNamePrefix("HashThread-");
        executor.initialize();
        return executor;
    }
}
```

---

## 6. Security & Persistence Architecture

1. **Local Security Model:**
   - When executed as a local desktop app sidecar, the Spring Boot application binds strictly to `127.0.0.1`.
   - Generates a transient `X-App-Token` header value on server startup, written to a shared local token file, required for all REST/WS connections.
2. **Persistence Architecture:**
   - **Preferences:** Utilizes Spring Boot configuration properties backed by Java Preferences API / local `.properties` store (`FilePreferences`).
   - **History Logs:** XML/JSON spool files saved under standard system user application folders (`~/.filebot/history.xml`).

---

## AUDIT ADDENDUM (2026-09-19) — DO NOT SILENTLY OVERWRITE ORIGINAL CONTENT ABOVE

A comprehensive parity audit (`specs/audit/MASTER_AUDIT_REPORT.md` and
`specs/audit/00_CROSSCUTTING_FINDINGS.md`) found that the architecture described
above is **not currently realized by the implementation** in two foundational,
cross-cutting ways that every other spec's WebSocket/DTO sections depend on:

1. **§4/§5 (STOMP/WebSocket real-time delivery) is entirely non-functional.**
   `src/main/java/net/filebot/backend/websocket/TaskProgressPublisher.java`'s
   `publishRenameProgress(...)`/`publishSfvProgress(...)` methods only append to a
   private in-memory list and are never called anywhere in the backend; no
   `SimpMessagingTemplate`/`.convertAndSend(...)` exists anywhere in
   `net.filebot.backend`. The broker itself is correctly configured
   (`WebSocketConfig`), and the frontend correctly subscribes — but nothing
   server-side ever publishes to `/topic/rename/progress`, `/topic/sfv/progress`, or
   `/topic/notifications`. Every real-time progress UI described in this spec and in
   specs 02/06 is non-functional today. See `00_CROSSCUTTING_FINDINGS.md` §X1 for
   full detail and the required fix (inject `SimpMessagingTemplate`, call it from
   inside the actual per-file loops of the real hashing/matching implementations once
   those exist — see specs 02/06 addenda).
2. **The `AppShellService` interface documented in §6/specs-01 §B does not exist.**
   `AppShellController` inlines all file-intake logic itself rather than delegating to
   a service, and the intake logic itself ignores `recursive`/`filterHidden` entirely
   — see `specs/01_APP_SHELL_NAVIGATION_AND_GLOBAL_DND.md`'s own addendum and
   `00_CROSSCUTTING_FINDINGS.md` §X2.

**Corrective note on domain enums:** `ConflictStrategy.AUTO_RENAME` (line 62) has
**no identifiable legacy precedent** anywhere in `net.filebot.ui.rename` or
`net.filebot.StandardRenameAction` — the real legacy app offers only two conflict
resolutions (skip, or trash-and-overwrite). Confirm intent with the product owner
before implementing "append a numeric counter" behavior as if it were a ported
feature; see `specs/audit/02_03_rename_format_audit.md` Ambiguous item AMB-1.

**Terminology correction (applies to all specs 00-10):** the legacy application's UI
is **Java Swing** (`javax.swing.*`), not JavaFX, with a single embedded JavaFX
`WebView` island (`GettingStartedStage.java`) for the onboarding screen only. Every
"JavaFX" reference throughout these specs should be read as referring to the Swing
codebase (`net.filebot.ui.*`) unless explicitly noted otherwise.
