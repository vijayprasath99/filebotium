# SFV Verification & Checksum Hashing Specification

## Section A: Legacy Codebase Analysis

### Source Files Audited
- `src/main/java/net/filebot/ui/sfv/SfvPanel.java`
- `src/main/java/net/filebot/ui/sfv/SfvPanelBuilder.java`
- `src/main/java/net/filebot/ui/sfv/ChecksumTable.java`
- `src/main/java/net/filebot/ui/sfv/ChecksumTableModel.java`
- `src/main/java/net/filebot/ui/sfv/ChecksumComputationService.java`
- `src/main/java/net/filebot/ui/sfv/ChecksumComputationTask.java`
- `src/main/java/net/filebot/hash/HashType.java`
- `src/main/java/net/filebot/hash/VerificationFileReader.java`
- `src/main/java/net/filebot/hash/VerificationFileWriter.java`
- `src/main/java/net/filebot/hash/SfvFormat.java`

### UI Hierarchy & Layout Mechanics
1. **SFV Verification Panel (`SfvPanel`)**:
   - Checksum Grid (`ChecksumTable`): Table displaying File Name, File Size, Expected Hash, Calculated Hash, Hash Algorithm (CRC32, MD5, SHA-1, SHA-256), and Status (`OK`, `MISMATCH`, `MISSING`, `ERROR`).
   - Hash Type Selector: Dropdown to toggle algorithm (`CRC32`, `MD5`, `SHA-1`, `SHA-256`).
   - Progress Panel (`TotalProgressPanel`): Displays real-time hashing speed (MB/s), total bytes processed, and overall task progress bar.
   - Toolbar Buttons: "Verify SFV", "Calculate Hashes", "Save Verification File" (`ChecksumTableExportHandler`).

### Extracted Business Logic & Multithreaded Engine
1. **Multithreaded Stream Hashing (`ChecksumComputationService`)**:
   - Spawns background worker threads (`ChecksumComputationTask`) to compute hash stream in chunks (typically 64KB - 256KB buffer sizes).
   - Reads existing verification files (`.sfv`, `.md5`, `.sha1`, `.sha256`) via `VerificationFileReader` to extract embedded expected hashes.
2. **SFV File Parsing & Export Rules (`VerificationFileWriter`)**:
   - SFV Format lines: `filename.rar 8A4F32C1` or `filename.mkv  a1b2c3d4e5f6...`.
   - Ignores comment lines starting with `;` in SFV files.

---

## Section B: Target Spring Boot Backend Specification

### Service Interfaces & DTOs

```java
package net.filebot.backend.service;

import net.filebot.backend.domain.HashType;
import net.filebot.backend.dto.ChecksumEntryDto;
import java.util.List;

public interface ChecksumService {
    String startVerificationTask(ChecksumVerificationRequestDto request);
    void cancelVerificationTask(String taskId);
    List<ChecksumEntryDto> parseVerificationFile(String sfvFilePath);
    String generateVerificationFileContent(ChecksumExportRequestDto request);
}

public record ChecksumVerificationRequestDto(
    List<String> filePaths,
    HashType hashType,
    String sfvFilePath
) {}

public record ChecksumExportRequestDto(
    List<ChecksumEntryDto> entries,
    HashType hashType,
    String outputPath
) {}

public record ChecksumProgressEventDto(
    String taskId,
    String currentFilePath,
    long bytesProcessed,
    long totalBytes,
    double MBps,
    double progressPercentage,
    ChecksumEntryDto completedEntry
) {}
```

### REST Endpoints

#### 1. Start Checksum Task Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/sfv/verify`
- **Request JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "filePaths": { "type": "array", "items": { "type": "string" } },
    "hashType": { "type": "string", "enum": ["CRC32", "MD5", "SHA_1", "SHA_256"] },
    "sfvFilePath": { "type": "string" }
  },
  "required": ["filePaths", "hashType"]
}
```

#### 2. Export SFV File Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/sfv/export`
- **Request JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "entries": { "type": "array" },
    "hashType": { "type": "string", "enum": ["CRC32", "MD5", "SHA_1", "SHA_256"] },
    "outputPath": { "type": "string" }
  },
  "required": ["entries", "hashType", "outputPath"]
}
```

### WebSocket / SSE Events
- **Topic:** `/topic/sfv/progress`
- **Payload Schema:** `ChecksumProgressEventDto` structure.

---

## Section C: Target React Frontend Specification

### Component Architecture

```
SfvPanel
├── SfvToolbar
│   ├── HashAlgorithmSelector (CRC32, MD5, SHA_1, SHA_256)
│   ├── LoadSfvFileButton
│   ├── StartVerificationButton
│   └── ExportSfvButton
├── HashComputationProgressHeader
│   ├── SpeedGauge (e.g., "450 MB/s")
│   ├── TotalProgressBar
│   └── ETAIndicator
└── ChecksumDataTable
    ├── TableHeader (File Name, Size, Expected Hash, Calculated Hash, Status)
    └── TableRow (Color-coded status badge: OK=Green, MISMATCH=Red, MISSING=Yellow)
```

### Props & State Types (TypeScript)

```typescript
import { HashType, ChecksumEntry } from './types';

export interface SfvPanelState {
  fileEntries: ChecksumEntry[];
  hashAlgorithm: HashType;
  isProcessing: boolean;
  activeTaskId: string | null;
  speedMBps: number;
  overallProgress: number;
}
```

---

## Section D: Dialogs, Modals & Edge Cases

1. **Checksum Mismatch Warning Alert:**
   - Highlights files in red whose calculated hash does not match expected SFV checksum.
2. **Missing Files Warning Modal:**
   - Displays files listed in imported `.sfv` file that were not found in local target directory.

---

## AUDIT ADDENDUM (2026-09-19) — DO NOT SILENTLY OVERWRITE ORIGINAL CONTENT ABOVE

Full detail: `specs/audit/06_sfv_audit.md`. **No file is ever actually hashed by this
feature today — it is a checksum verification tool that cannot detect mismatches,**
which is more dangerous than a missing feature because it actively reports false
"OK" verdicts.

- **GAP-01/GAP-06 (BROKEN_FUNCTIONALITY, top priority):**
  `ChecksumServiceImpl.startVerificationTask()` is `return
  UUID.randomUUID().toString();` — no CRC32/MessageDigest, no file I/O, nothing.
  Zero hash-computation code of any kind exists anywhere in the backend.
- **GAP-02 (DATA_INTEGRITY_RISK, critical):** `SfvPanel.tsx`'s `handleVerify` waits
  1200ms after the fake taskId, then **fabricates the result client-side**: any
  entry with a known `expectedHash` is forced to report `OK` by construction; any
  entry without one gets a **random hex string** as its "calculated hash." A real
  file mismatch, corruption, or wrong file can never be detected through this code
  path. **This must be fixed before this feature ships to any user relying on it for
  data integrity verification.**
- **GAP-07/GAP-08 (BROKEN_FUNCTIONALITY/DATA_INTEGRITY_RISK):** verification-file
  parsing hardcodes `SfvFormat()` (8-hex CRC32 only) regardless of the file's real
  extension — loading a `.md5`/`.sha1`/`.sha256` file silently returns zero entries.
  Export similarly hand-builds SFV-shaped `"path hash"` lines for every hash type,
  producing MD5/SHA1/SHA256 files unreadable by standard tools (`md5sum -c` etc.) or
  even by FileBot's own legacy parser.
- **GAP-03/GAP-04/GAP-05 (BROKEN_FUNCTIONALITY):** none of §C's progress-header UI
  (SpeedGauge/TotalProgressBar/ETAIndicator) exists in the React tree at all — not
  even unwired markup — and the backend has no concurrency primitive of any kind
  (the documented `hashingExecutor` bean from specs/00 is never declared/used); ties
  to specs/00 addendum §X1 (dead `TaskProgressPublisher`).
- **New requirement — primary reuse targets:** `net.filebot.hash.{HashType.newHash(),
  ChecksumHash,MessageDigestHash}` for real hashing;
  `net.filebot.util.FileUtilities.BUFFER_SIZE` (64KB, confirmed) for chunked reads;
  `net.filebot.hash.VerificationUtilities.getHashType(File)` for correct
  per-extension format dispatch; `net.filebot.hash.{VerificationFileWriter,
  VerificationFormat,SfvFormat}` for byte-correct export.
- Full gap table (GAP-01 through GAP-12, including the missing `WARNING` status for
  filename-embedded-checksum mismatches and the yellow-vs-grey MISSING color
  discrepancy) is in the audit file.
