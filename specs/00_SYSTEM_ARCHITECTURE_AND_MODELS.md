# System Architecture & Core Domain Model Specification

## 1. High-Level Target Architecture

The target architecture for the migrated FileBot application decouples the legacy Java Swing user interface into a headless **Spring Boot 3 (Java 17)** backend service and a **React 18+ (TypeScript, Tailwind CSS)** frontend web application. The frontend can run in standard desktop web browsers or packaged inside desktop wrappers (Tauri, Electron, or jpackage native launcher) for Windows, macOS, and Linux.

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

## 2. Core Domain Models & Data Transfer Objects (DTOs)

### 2.1 MediaFile Model
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

### 2.2 Episode Model
Represents episode metadata fetched from providers (TheTVDB, TMDb, AniDB, TVMaze).

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import java.io.Serializable;
import java.time.LocalDate;

public record EpisodeDto(
    String provider,
    String seriesName,
    Integer seriesId,
    Integer seasonNumber,
    Integer episodeNumber,
    Integer absoluteNumber,
    String title,
    LocalDate releaseDate,
    String language,
    String overview
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export interface Episode {
  provider: 'TheTVDB' | 'TMDb' | 'AniDB' | 'TVMaze';
  seriesName: string;
  seriesId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteNumber: number | null;
  title: string;
  releaseDate: string | null; // YYYY-MM-DD
  language: string;
  overview?: string;
}
```

---

### 2.3 Movie Model
Represents movie metadata fetched from providers (TMDb, OMDb).

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import java.io.Serializable;

public record MovieDto(
    String provider,
    String title,
    Integer year,
    Integer tmdbId,
    String imdbId,
    String language,
    String overview
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export interface Movie {
  provider: 'TMDb' | 'OMDb';
  title: string;
  year: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  language: string;
  overview?: string;
}
```

---

### 2.4 Match Model
Pairs a source `MediaFile` with a target metadata object (`Episode`, `Movie`, or `AudioTrack`) and calculated similarity metrics.

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import java.io.Serializable;

public record MatchDto(
    String matchId,
    MediaFileDto sourceFile,
    Object targetMetadata, // EpisodeDto or MovieDto
    double score,
    String formattedName,
    String formattedPath,
    boolean isExcluded,
    String status // 'MATCHED', 'CONFLICT', 'MANUAL'
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export interface Match {
  matchId: string;
  sourceFile: MediaFile;
  targetMetadata: Episode | Movie | null;
  score: number;
  formattedName: string;
  formattedPath: string;
  isExcluded: boolean;
  status: 'MATCHED' | 'CONFLICT' | 'MANUAL';
}
```

---

### 2.5 History & Transaction Models
Logs file operations (`MOVE`, `COPY`, `HARDLINK`, `SYMLINK`) for rollback.

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;

public record HistoryElementDto(
    String sourcePath,
    String targetPath,
    String action, // MOVE, COPY, HARDLINK, SYMLINK
    String status  // COMPLETED, ROLLED_BACK, FAILED
) implements Serializable {}

public record HistoryTransactionDto(
    String transactionId,
    Instant timestamp,
    List<HistoryElementDto> elements
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export interface HistoryElement {
  sourcePath: string;
  targetPath: string;
  action: 'MOVE' | 'COPY' | 'HARDLINK' | 'SYMLINK';
  status: 'COMPLETED' | 'ROLLED_BACK' | 'FAILED';
}

export interface HistoryTransaction {
  transactionId: string;
  timestamp: string; // ISO 8601
  elements: HistoryElement[];
}
```

---

### 2.6 Subtitle & Checksum Models

**Java Record Specification:**
```java
package net.filebot.backend.dto;

import java.io.Serializable;

public record SubtitleDescriptorDto(
    String provider,
    String id,
    String name,
    String language,
    String format,
    double score,
    String downloadUrl
) implements Serializable {}

public record ChecksumEntryDto(
    String path,
    String expectedHash,
    String calculatedHash,
    String hashType, // CRC32, MD5, SHA-1, SHA-256
    String status    // OK, MISMATCH, MISSING, ERROR
) implements Serializable {}
```

**TypeScript Model:**
```typescript
export interface SubtitleDescriptor {
  provider: 'OpenSubtitles' | 'Shooter';
  id: string;
  name: string;
  language: string;
  format: string;
  score: number;
  downloadUrl: string;
}

export interface ChecksumEntry {
  path: string;
  expectedHash: string | null;
  calculatedHash: string | null;
  hashType: 'CRC32' | 'MD5' | 'SHA-1' | 'SHA-256';
  status: 'OK' | 'MISMATCH' | 'MISSING' | 'ERROR';
}
```

---

## 3. Communication Strategy: REST & WebSocket / SSE

- **REST API:** Handles synchronous request/response operations (fetching settings, triggering searches, evaluating single format expressions, initiating file renaming).
- **STOMP over WebSocket (`/ws` endpoint):** Handles real-time progress updates for long-running asynchronous tasks (batch matching, multi-file hash verification, subtitle batch downloading, file batch renaming).
- **Server-Sent Events (SSE `/api/v1/events/stream`):** Serves as an alternative fallback for unidirectional background status updates and global notifications.

---

## 4. Async Event Loop, Thread Pools, and Resource Management

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

## 5. Security & Persistence Architecture

1. **Local Security Model:**
   - When executed as a local desktop app sidecar, the Spring Boot application binds strictly to `127.0.0.1`.
   - Generates a transient `X-App-Token` header value on server startup, written to a shared local token file, required for all REST/WS connections.
2. **Persistence Architecture:**
   - **Preferences:** Utilizes Spring Boot configuration properties backed by Java Preferences API / local `.properties` store (`FilePreferences`).
   - **History Logs:** XML/JSON spool files saved under standard system user application folders (`~/.filebot/history.xml`).
