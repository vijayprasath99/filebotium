# History & Transaction Rollback Specification

## Section A: Legacy Codebase Analysis

### Source Files Audited
- `src/main/java/net/filebot/ui/HistoryPanel.java`
- `src/main/java/net/filebot/ui/rename/HistoryDialog.java`
- `src/main/java/net/filebot/History.java`
- `src/main/java/net/filebot/HistorySpooler.java`
- `src/main/java/net/filebot/cli/CmdlineOperations.java`

### UI Hierarchy & Layout Mechanics
1. **History Panel (`HistoryPanel`) & Modal (`HistoryDialog`)**:
   - Transaction List: Displays chronological list of rename sessions grouped by timestamp.
   - Session Details Table: Dual columns showing Original Path $\rightarrow$ Renamed/Target Path.
   - Action Toolbar:
     - "Rollback / Revert": Initiates inverse file operation.
     - "Clear History": Purges persistent transaction logs.
     - "Export History": Exports logs to XML, CSV, or HTML.

### Extracted Business Logic & Reverse Rollback Engine
1. **Persistence Schema (`History` / `HistorySpooler`)**:
   - Persists execution history to XML spool files (`~/.filebot/history.xml`).
   - Log structure: `<history><sequence date="..." count="..."><element from="..." to="..."/></sequence></history>`.
2. **Reverse File Operation Rollback Rules**:
   - `MOVE`: Moves file from `to` path back to `from` path. Creates parent directories of `from` if missing; deletes empty parent directories of `to` if empty.
   - `COPY`: Deletes created file at `to` path.
   - `HARDLINK` / `SYMLINK`: Removes link created at `to` path.

---

## Section B: Target Spring Boot Backend Specification

### Service Interfaces & DTOs

```java
package net.filebot.backend.service;

import net.filebot.backend.dto.HistoryTransactionDto;
import net.filebot.backend.dto.RollbackResultDto;
import java.util.List;

public interface HistoryService {
    List<HistoryTransactionDto> getTransactionHistory();
    HistoryTransactionDto getTransactionById(String transactionId);
    RollbackResultDto rollbackTransaction(RollbackRequestDto request);
    void clearHistory();
    void exportHistory(String format, String outputPath);
}

public record RollbackRequestDto(
    String transactionId,
    List<String> targetPathsToRollback
) {}

public record RollbackResultDto(
    String transactionId,
    int successCount,
    int failureCount,
    List<RollbackErrorDto> errors
) {}

public record RollbackErrorDto(
    String targetPath,
    String expectedSourcePath,
    String errorMessage
) {}
```

### REST Endpoints

#### 1. Get History Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/history`
- **Response JSON Schema:** List of `HistoryTransactionDto` objects.

#### 2. Rollback Transaction Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/history/rollback`
- **Request JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "transactionId": { "type": "string" },
    "targetPathsToRollback": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["transactionId"]
}
```

#### 3. Clear History Endpoint
- **Method:** `DELETE`
- **Path:** `/api/v1/history`
- **Status Code:** `204 No Content`

---

## Section C: Target React Frontend Specification

### Component Architecture

```
HistoryPanel
├── HistoryHeaderToolbar
│   ├── SearchHistoryInput
│   ├── ClearHistoryButton
│   └── ExportHistoryButton
├── TransactionTimeline
│   └── TransactionCard (Timestamp, Item Count, Actions)
│       └── TransactionElementTable (Source Path, Target Path, Status, Rollback Row Toggle)
└── RollbackConfirmationModal
```

### Props & State Types (TypeScript)

```typescript
import { HistoryTransaction } from './types';

export interface HistoryPanelState {
  transactions: HistoryTransaction[];
  selectedTransactionId: string | null;
  filterQuery: string;
  isRollingBack: boolean;
}
```

---

## Section D: Dialogs, Modals & Edge Cases

1. **Missing Target File Alert:**
   - Prompted during rollback if the file at `targetPath` was moved or deleted outside FileBot.
2. **Directory Deletion Warning Modal:**
   - Prompted when reversing file operations will prune empty parent directories.
