# History & Transaction Rollback Specification

**Status:** As-built. This document describes the History/Rollback feature as it is actually
implemented (backend: `net.filebot.backend.{controller,service,dto}.History*`; frontend:
`frontend/src/components/HistoryPanel.tsx`). Prior to this implementation pass, every write
path in this area was fabricated: renames performed through the app were never recorded to
history at all, rollback only checked `File.exists()` and reported invented success/failure
without touching a single file, and export hand-built client-side XML that legacy's own
importer could not read. All three are now real; this spec documents the real behavior and
still-open gaps precisely so neither regresses silently.

---

## 1. UI (`HistoryPanel.tsx`)

Reached via the sidebar's **History** tab (`WorkspaceTab.HISTORY` — see spec 00 §2 and spec 01
§2 for why this is a separate tab from **List**, which it used to be confused with).

- **Transaction table**, one row per `HistoryElementDto`, flattened out of all transactions:
  Timestamp, Source File Path, Renamed Target Path, Action (currently always renders `MOVE`
  — see §6), and a per-row **Undo** button.
- **Filter bar**: a live, case-insensitive, multi-word **AND** filter across the concatenated
  source+target path of each row (`filterQuery.split(/\s+/)`, every term must appear
  somewhere in `sourcePath + " " + targetPath}`). Mirrors legacy `HistoryDialog`'s
  `filterEditor` behavior. Typing "office s01" only shows rows where both substrings appear.
  An empty result set renders a distinct `No history entries match "..."` row rather than the
  generic empty state.
- **Refresh**: re-fetches `GET /api/v1/history`.
- **Export XML**: downloads the real server-generated XML as a file (see §5).
- **Clear History**: calls `DELETE /api/v1/history`, which is a confirmed no-op today (see
  §6) — the button still exists and the confirm dialog still fires, but nothing is actually
  deleted server-side; only the frontend's own `transactions` state is cleared, so a Refresh
  immediately re-shows the untouched log.
- **Undo (rollback) confirmation**: clicking a row's Undo button shows a native
  `window.confirm("Undo rename and restore \"<filename>\" to its original name/location?")`
  before calling the rollback endpoint. No confirmation existed before this pass — rollback
  used to fire immediately on click.

## 2. REST Contract (`HistoryController`, base path `/api/v1/history`)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/history` | — | `HistoryTransactionDto[]` |
| GET | `/history/{id}` | — | `HistoryTransactionDto` or `null` |
| POST | `/history/rollback` | `RollbackRequestDto` | `RollbackResultDto` |
| DELETE | `/history` | — | 200, no body (no-op — see §6) |
| GET | `/history/export?format=xml` | — | `byte[]` XML, `Content-Disposition: attachment; filename="history.xml"` |

```java
public record HistoryElementDto(
    String sourcePath, String targetPath, FileAction action, HistoryStatus status)
    implements Serializable {}

public record HistoryTransactionDto(
    String transactionId, Instant timestamp, List<HistoryElementDto> elements)
    implements Serializable {}

public record RollbackRequestDto(String transactionId, List<String> targetPathsToRollback)
    implements Serializable {}
// targetPathsToRollback == null or empty => roll back every element in the transaction.

public record RollbackResultDto(
    String transactionId, int successCount, int failureCount, List<RollbackErrorDto> errors)
    implements Serializable {}

public record RollbackErrorDto(String targetPath, String expectedSourcePath, String errorMessage)
    implements Serializable {}
```

## 3. Where transaction data actually comes from

`HistoryServiceImpl` never writes to history itself — it only *reads* via
`net.filebot.HistorySpooler.getInstance().getCompleteHistory()` (legacy class, reused
verbatim; merges the current in-memory session history with `~/.filebot/history.xml` on
disk). The write path lives in `RenameWorkspaceServiceImpl.executeRename()` (spec 02 §4):
after each successful file operation in a batch, if `renameAction.canRevert()` is true, the
`(source -> destination)` pair is accumulated into a `Map<File,File>` and, once the whole
batch finishes, appended in one call:

```java
if (renameAction.canRevert()) {
  historyBatch.put(source, destination);
}
...
if (!historyBatch.isEmpty()) {
  HistorySpooler.getInstance().append(historyBatch);
}
```

`canRevert()` is `net.filebot.RenameAction`'s default method, returning `true` unless
overridden. Only `StandardRenameAction.TEST` overrides it to `false` — and `TEST` is not one
of the four actions (`MOVE`/`COPY`/`HARDLINK`/`SYMLINK`) reachable through
`RenameExecutionRequestDto.action()` (a `backend.domain.FileAction`). **Practical
consequence:** every successful rename executed through this app's Rename workspace is
recorded to history — the `canRevert()` gate is real defensive code, not currently a live
filter, since nothing this API can execute ever returns `false` from it.

## 4. Real rollback (`rollbackTransaction`)

1. Read the complete history via `HistorySpooler`.
2. Find the `History.Sequence` whose derived ID (see §7) equals `request.transactionId()`. If
   none matches, every requested `targetPathsToRollback` entry (or a single placeholder entry
   if none were given) becomes a `RollbackErrorDto(path, "", "Transaction not found")`, and
   `failureCount` equals that count — `successCount` is `0`.
3. Otherwise, build a `Map<File current, File original>` from that sequence's real
   `History.Element` entries (`element.dir()`/`element.from()`/`element.to()` — same
   from/to resolution logic as `getTransactionHistory()`, see §7).
4. For each requested target path (or every target in the map, if none were requested):
   - If the target isn't a key in the map: `RollbackErrorDto(target, "", "No matching history
     entry for this path")`, counted as a failure.
   - Otherwise call **`net.filebot.StandardRenameAction.revert(File current, File original)`**
     — legacy's real reversal logic, reused verbatim. It dispatches MOVE/COPY/HARDLINK/
     SYMLINK/KEEPLINK reversal purely by inspecting live filesystem state (symlink vs. regular
     file vs. directory), since `History.Element` never persisted which action produced it.
     Success/exception is mapped straight to `successCount`/`failureCount` +
     `RollbackErrorDto(target, original, exceptionMessage)`.

This means rollback genuinely moves/restores files on disk and genuinely fails when it should
(target already gone, permission error, etc.) — there is no `File.exists()`-only shortcut
left anywhere in this path.

## 5. Real export (`exportHistory`)

`HistoryServiceImpl.exportHistory(format)` calls **`net.filebot.History.exportHistory(history,
OutputStream)`** (legacy's real JAXB marshaller) into a `ByteArrayOutputStream` and returns
the raw bytes. `HistoryController.exportHistory` streams those bytes back with
`Content-Disposition: attachment; filename="history.xml"`; the frontend downloads the
response `Blob` directly — it does **not** hand-build XML client-side anymore.

**Real schema** (do not confuse with a plausible-looking invented one):

```xml
<history>
  <sequence date="...">
    <rename dir="..." from="..." to="..." />
  </sequence>
</history>
```

The element tag is **`<rename>`**, not `<element>`; `dir` is a required attribute (the folder
the `from`/relative-`to` are resolved against); there is **no `count` attribute** on
`<sequence>`. This is the schema `~/.filebot/history.xml` itself uses, so any tool round-
tripping this export must match it exactly to interoperate with legacy FileBot's own history
file.

`format` only ever produces XML today — a `csv`/`html` value is silently accepted by the
`@RequestParam` binding and produces the same XML bytes regardless (see §6).

## 6. Deliberate no-ops / accepted limitations

- **`clearHistory()` is an intentional no-op.** No legacy UI action for "clear history" was
  ever confirmed to exist (`HistoryDialog`'s full inventory has no such button/menu item).
  Implementing real deletion of `~/.filebot/history.xml` needs an explicit product decision
  first — silently wiping a user's undo log on a guess would be a genuine data-loss risk. If
  this is confirmed in scope, `HistorySpooler` would need a `truncate()`/clear-equivalent
  primitive that does not currently exist as a public operation.
- **`FileAction` in `HistoryElementDto` is hardcoded to `MOVE`** in `getTransactionHistory()`,
  regardless of which action (`COPY`/`HARDLINK`/`SYMLINK`) actually produced the entry. This
  mirrors a genuine legacy limitation: `History.Element` never persisted an action-type field
  either, so there is no data to read the real value back from without a history-file schema
  change (which would break compatibility with existing `~/.filebot/history.xml` files). Not
  considered a bug to silently "fix" — a schema migration would need to be a deliberate,
  versioned decision.
- **`format=csv`/`format=html` are accepted but not implemented.** Only real XML export
  exists; do not assume the `format` parameter does anything today.
- **No directory-remap recovery flow.** If a rollback's original parent directory no longer
  exists, `StandardRenameAction.revert()` simply throws and the row is reported as a failure
  with the exception message — there is no UI flow to let the user pick a different
  destination directory and retry, unlike some legacy dialogs' recovery prompts.

## 7. Stable transaction IDs

`HistoryServiceImpl` derives every transaction's ID as
`String.valueOf(sequence.date().getTime())` (or the literal string `"unknown"` if a sequence
somehow has no date) — **not** a fresh `UUID.randomUUID()` per call. This is what makes
`GET /api/v1/history/{id}` and rollback-by-ID actually work: a random ID minted per call to
`getTransactionHistory()` would never match anything from a prior call, since nothing persists
it. Because the ID is derived from data already present in `history.xml`, it is stable across
backend restarts and across every read.

Both `getTransactionHistory()` and `rollbackTransaction()` resolve a target's original path
identically: `from = new File(element.dir(), element.from())`, and `to = new
File(element.to())`, falling back to `new File(element.dir(), element.to())` when
`element.to()` is not already absolute. Keep this resolution logic in sync between the two
methods if either changes — a divergence would make rollback silently target the wrong file.

## 8. Frontend contract (`historyApi`, `frontend/src/api/client.ts`)

```typescript
getHistory(): Promise<HistoryTransaction[]>                        // GET  /history
rollbackTransaction(transactionId, targetPathsToRollback?)          // POST /history/rollback
  : Promise<RollbackResult>
clearHistory(): Promise<void>                                       // DELETE /history (no-op)
exportHistory(format = 'xml'): Promise<Blob>                        // GET /history/export
```
