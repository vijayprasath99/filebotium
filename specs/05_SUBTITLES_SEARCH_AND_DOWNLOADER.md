# Subtitles Search & Downloader Specification

## Section A: Legacy Codebase Analysis

### Source Files Audited
- `src/main/java/net/filebot/ui/subtitle/SubtitlePanel.java`
- `src/main/java/net/filebot/ui/subtitle/SubtitlePanelBuilder.java`
- `src/main/java/net/filebot/ui/subtitle/SubtitleAutoMatchDialog.java`
- `src/main/java/net/filebot/ui/subtitle/SubtitleDownloadComponent.java`
- `src/main/java/net/filebot/ui/subtitle/upload/SubtitleUploadDialog.java`
- `src/main/java/net/filebot/web/OpenSubtitlesClient.java`
- `src/main/java/net/filebot/web/OpenSubtitlesXmlRpc.java`
- `src/main/java/net/filebot/web/OpenSubtitlesHasher.java`
- `src/main/java/net/filebot/web/ShooterSubtitles.java`
- `src/main/java/net/filebot/web/VideoHashSubtitleService.java`

### UI Hierarchy & Layout Mechanics
1. **Subtitle Panel Layout (`SubtitlePanel`)**:
   - Left Side Drop Area / Table (`SubtitleDownloadComponent`): Displays local video files added for subtitle searching.
   - Right Side Subtitle Package Tree: Displays available subtitle downloads matched per video file.
   - Language Combobox (`SimpleComboBox`): Filters subtitles by language (e.g., English, German, Spanish).
   - Provider Selection: Choice between OpenSubtitles and Shooter.
   - Dialogs: Auto-match dialog (`SubtitleAutoMatchDialog`), Subtitle viewer (`SubtitleViewer`), and Subtitle upload dialog (`SubtitleUploadDialog`).

### Extracted Business Logic & Hashing Math
1. **OpenSubtitles 64-bit File Hash Algorithm (`OpenSubtitlesHasher`)**:
   - Calculates a 64-bit checksum composed of file size + 64-bit sum of first 64KB and last 64KB of the file stream.
```java
public static long computeHash(File file) throws IOException {
    long size = file.length();
    long checksum = size;
    try (FileChannel ch = FileChannel.open(file.toPath(), StandardOpenOption.READ)) {
        ByteBuffer buf = ByteBuffer.allocate(64 * 1024).order(ByteOrder.LITTLE_ENDIAN);
        ch.read(buf);
        buf.rewind();
        while (buf.hasRemaining()) { checksum += buf.getLong(); }

        buf.clear();
        ch.position(Math.max(0, size - 64 * 1024));
        ch.read(buf);
        buf.rewind();
        while (buf.hasRemaining()) { checksum += buf.getLong(); }
    }
    return checksum;
}
```
2. **Shooter Hash Algorithm (`ShooterSubtitles`)**:
   - Reads 4 blocks at positions `5k`, `size/3`, `2*size/3`, and `size-8k` (8KB each), computing MD5 hashes for precise subtitle matching.

---

## Section B: Target Spring Boot Backend Specification

### Service Interfaces & DTOs

```java
package net.filebot.backend.service;

import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.SubtitleFormat;
import net.filebot.backend.domain.SubtitleProviderType;
import net.filebot.backend.dto.SubtitleDescriptorDto;
import net.filebot.backend.dto.SubtitleDownloadResultDto;
import java.util.List;

public interface SubtitleService {
    String computeOpenSubtitlesHash(String filePath);
    List<SubtitleDescriptorDto> searchSubtitles(SubtitleSearchRequestDto request);
    SubtitleDownloadResultDto downloadSubtitles(List<SubtitleDownloadRequestDto> requests);
    void uploadSubtitle(SubtitleUploadRequestDto request);
}

public record SubtitleSearchRequestDto(
    List<String> videoFilePaths,
    LanguageCode language,
    SubtitleProviderType provider
) {}

public record SubtitleDownloadRequestDto(
    String videoFilePath,
    String subtitleId,
    SubtitleProviderType provider,
    SubtitleFormat targetFormat
) {}

public record SubtitleUploadRequestDto(
    String videoFilePath,
    String subtitleFilePath,
    LanguageCode language,
    String imdbId
) {}

public record SubtitleDownloadResultDto(
    int successCount,
    int failureCount,
    List<String> downloadedSubtitlePaths
) {}
```

### REST Endpoints

#### 1. Search Subtitles Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/subtitles/search`
- **Request JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "videoFilePaths": { "type": "array", "items": { "type": "string" } },
    "language": { "type": "string", "enum": ["EN", "DE", "FR", "ES", "IT", "JA", "ZH", "KO", "RU"] },
    "provider": { "type": "string", "enum": ["OPEN_SUBTITLES", "SHOOTER"] }
  },
  "required": ["videoFilePaths", "language", "provider"]
}
```

#### 2. Download Subtitles Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/subtitles/download`
- **Request JSON Schema:** List of `SubtitleDownloadRequestDto`.

---

## Section C: Target React Frontend Specification

### Component Architecture

```
SubtitlePanel
├── SubtitleMatchGrid (Split View)
│   ├── LeftVideoColumn (Video File Names)
│   └── RightSubtitleTree (Expandable subtitle matches with Globe/Download icons)
├── BottomToolbar
│   ├── LeftControls
│   │   ├── ExactSearchButton
│   │   └── FuzzySearchButton
│   └── RightControls
│       ├── SubtitleNamingDropdown (e.g., "Match Video and Language")
│       ├── DownloadButton (Green icon)
│       └── CloseButton (Red icon)
├── SubtitlePreviewModal
└── SubtitleUploadModal
```

### Props & State Types (TypeScript)

```typescript
import { SubtitleProviderType, LanguageCode, SubtitleDescriptor } from './types';

export interface SubtitlePanelState {
  videoFiles: MediaFile[];
  searchResults: Record<string, SubtitleDescriptor[]>;
  selectedLanguage: LanguageCode;
  selectedProvider: SubtitleProviderType;
  isSearching: boolean;
  isDownloading: boolean;
}
```

---

## Section D: Dialogs, Modals & Edge Cases

1. **OpenSubtitles Authentication Modal:**
   - Prompted when OpenSubtitles requires VIP / user login credentials.
2. **Subtitle Upload Modal (`SubtitleUploadDialog`):**
   - Form fields: Video file selection, Subtitle file selection, Movie/Series search query (IMDb ID), Language selector.

---

## AUDIT ADDENDUM (2026-09-19) — DO NOT SILENTLY OVERWRITE ORIGINAL CONTENT ABOVE

Full detail: `specs/audit/05_subtitles_audit.md`. **This entire feature area is
fabricated end-to-end** — the only genuinely working piece is the hash computation.

- **G1/G2/G3 (BROKEN_FUNCTIONALITY/DATA_INTEGRITY_RISK):**
  `SubtitleServiceImpl.searchSubtitles()` never calls `OpenSubtitlesClient`/
  `OpenSubtitlesXmlRpc` or `ShooterSubtitles` — it fabricates one descriptor per
  input file (`filename+".srt"`, a fake `subtitles.filebot.net` URL, hardcoded
  `score=0.90`). The "Exact Search"/"Fuzzy Search" buttons are also **mismapped**:
  legacy's Exact=hash-based/Fuzzy=name-based distinction is real
  (`SubtitleUtilities.lookupSubtitlesByHash`/`.findSubtitlesByName`, running in
  parallel against one account); the port instead maps them to a
  `OPEN_SUBTITLES`/`SHOOTER` provider switch that the backend then ignores anyway.
- **G4 (DATA_INTEGRITY_RISK):** `downloadSubtitles()` performs **no I/O of any
  kind** — string-replaces the extension to `.srt` and unconditionally reports
  success. The success toast the user sees is always false.
- **G6/G7 (BROKEN_FUNCTIONALITY):** the Subtitle Upload Modal described above does
  not exist anywhere in React, and `SubtitleServiceImpl.uploadSubtitle()` is a
  literal no-op comment. The OpenSubtitles login/VIP-quota modal (spec §A) also has
  no React equivalent.
- **G12 (DATA_INTEGRITY_RISK, structural):** the wire contract itself
  (`SubtitleSearchRequestDto` → flat `List<SubtitleDescriptorDto>`) has **no
  per-video association field**, making it structurally impossible for the frontend
  to correctly attribute multiple real candidates to the correct video once real
  search is implemented (a real provider can return 0, 1, or many results per
  video). **New requirement:** add a `videoFilePath` field to
  `SubtitleDescriptorDto` before implementing real search, not after.
- **New requirement — primary reuse targets for a real implementation:**
  `net.filebot.subtitle.SubtitleUtilities.{lookupSubtitlesByHash,findSubtitlesByName,
  getBestMatch,matchSubtitles}` for the real Exact/Fuzzy strategies;
  `net.filebot.web.{OpenSubtitlesClient,ShooterSubtitles,VideoHashSubtitleService}`
  for provider access; `net.filebot.subtitle.SubtitleNaming.format(...)` for correct
  output filenames (currently the "Subtitle Naming" dropdown in §C is 100%
  cosmetic — its selected value is never even sent to the backend).
- Full gap table (G1-G12, including the 4-of-16-languages regression and the
  provider-mismatch-on-download latent bug) is in the audit file.
