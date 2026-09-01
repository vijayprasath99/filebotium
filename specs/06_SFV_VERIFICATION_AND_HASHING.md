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

import net.filebot.backend.dto.ChecksumEntryDto;
import java.util.List;

public interface ChecksumService {
    String startVerificationTask(List<String> filePaths, String hashType, String sfvFilePath);
    void cancelVerificationTask(String taskId);
    List<ChecksumEntryDto> parseVerificationFile(String sfvFilePath);
    String generateVerificationFileContent(List<ChecksumEntryDto> entries, String hashType);
}

public record ChecksumVerificationRequestDto(
    List<String> filePaths,
    String hashType, // CRC32, MD5, SHA-1, SHA-256
    String sfvFilePath
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
    "hashType": { "type": "string", "enum": ["CRC32", "MD5", "SHA-1", "SHA-256"] },
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
    "hashType": { "type": "string" },
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
│   ├── HashAlgorithmSelector (CRC32, MD5, SHA-1, SHA-256)
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
export interface SfvPanelState {
  fileEntries: ChecksumEntry[];
  hashAlgorithm: 'CRC32' | 'MD5' | 'SHA-1' | 'SHA-256';
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
