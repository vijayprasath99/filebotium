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

---

## AUDIT ADDENDUM (2026-09-19) — DO NOT SILENTLY OVERWRITE ORIGINAL CONTENT ABOVE

Full detail: `specs/audit/08_history_and_list_audit.md`. **This is the second most
severe area in the audit after Rename/Format** — the rollback feature this whole
document specifies performs no file operations at all, and nothing feeds it real
data in the first place.

- **Gap 3 (BROKEN_FUNCTIONALITY, root cause, fix this first):** renames executed
  through the new app are **never written to history anywhere** —
  `RenameWorkspaceServiceImpl` has zero references to `HistorySpooler`/rollback/
  revert (confirmed via grep). `HistoryPanel` can therefore only ever display
  transactions produced by a legacy Swing session or CLI run against the same
  `~/.filebot` profile — it is a read-only viewer of *other tools'* history, not of
  the app it lives in. Fix: call `net.filebot.HistorySpooler.getInstance()
  .append(renameMap.entrySet())` immediately after each successful batch rename in
  `RenameWorkspaceServiceImpl.executeRename()`, mirroring
  `CmdlineOperations.writeHistory()` exactly (including its `action.canRevert()`
  gate).
- **Gap 2 (DATA_INTEGRITY_RISK, worse than a no-op):**
  `HistoryServiceImpl.rollbackTransaction()` performs **no file operation
  whatsoever** — it only checks `File.exists()` and reports success/failure based
  on that alone. Clicking "Undo" on a row whose target file happens to still exist
  **falsely reports a successful rollback while touching nothing on disk.** Fix:
  call `net.filebot.StandardRenameAction.revert(File current, File original)` per
  target path — it already handles MOVE/COPY/HARDLINK/SYMLINK/KEEPLINK reversal
  purely from filesystem state (legacy's `History.Element` schema carries no
  action-type field at all, so no schema change is needed to do this correctly).
- **Gap 4 (DATA_INTEGRITY_RISK):** `HistoryServiceImpl.clearHistory()`'s body is
  literally the comment `// Session history clear` — it does nothing.
  `~/.filebot/history.xml` is never touched even though the UI reports success.
  **Also: this spec's own "Clear History" feature (§A) has no legacy precedent** —
  a full inventory of `HistoryDialog`'s buttons/menus found no such action anywhere
  in legacy. Confirm with the product owner whether this should be a net-new
  feature (in which case it needs a real implementation) or removed from scope.
- **Gap 5 + spec correction (BROKEN_FUNCTIONALITY):** two independent,
  mutually-inconsistent export paths exist — the backend correctly reuses
  `net.filebot.History.exportHistory()` (good) but writes to the server's own
  working directory, never surfaced to the Electron user; React then **discards
  that response and hand-builds its own incompatible XML** client-side (wrong tag
  name, missing required attribute, invented attribute). **This spec's §A line 24
  XML schema is also wrong** — the real JAXB schema (from `History.java`'s
  annotations) is `<history><sequence date="...">` (no `count` attribute)
  `<rename dir="..." from="..." to="..."/></sequence></history>` — tag is
  `<rename>`, not `<element>`, and `dir` is a required attribute the spec omits.
  Any importer/exporter must be built against this corrected schema, not the
  spec's literal text, to stay compatible with existing `~/.filebot/history.xml`
  files.
- **Gap 1 (BROKEN_FUNCTIONALITY):** see specs/01 addendum AS-3/AS-4 — History has
  no discoverable entry point; it is reachable only via a sidebar tab mislabeled
  "List."
- **Spec correction:** §A's claim that MOVE-rollback "deletes empty parent
  directories of `to` if empty" does not correspond to any code found in
  `StandardRenameAction.revert()` or its call sites — no such pruning logic exists
  in the reviewed source.
- Full gap table (Gap 1 through Gap 10, including the non-deterministic
  transaction-ID bug that breaks `GET /api/v1/history/{id}`) is in the audit file.
