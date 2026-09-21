# SFV Verification & Checksum Hashing Specification

**Status:** As-built. This document describes the SFV/checksum feature as it is actually
implemented (backend: `net.filebot.backend.service.ChecksumServiceImpl`,
`net.filebot.backend.controller.SfvController`; frontend: `frontend/src/components/SfvPanel.tsx`),
not an aspirational target. Cross-reference `specs/00_SYSTEM_ARCHITECTURE_AND_MODELS.md` §5 for
the shared concurrency-model rationale (synchronous execution, no background task queue) — that
decision is explained once, there, and applies to this area's hashing exactly as described.

Earlier in this project's history, this entire feature was fabricated end-to-end:
`startVerificationTask` literally returned `UUID.randomUUID().toString()` with zero file I/O,
and the frontend then invented a "calculated hash" client-side — forcibly setting it equal to
the expected hash when one existed (guaranteeing a fake "OK"), or generating a random hex
string otherwise. None of that remains; every hash below is a real, freshly computed digest.

---

## 1. UI (`SfvPanel.tsx`)

Layout: a control bar, an optional base-path-override bar, a status bar, a results table, and
(conditionally) a Missing Files Warning modal.

**Control bar:**
- **Algorithm** select — `CRC32 (.sfv)`, `MD5 (.md5)`, `SHA-1 (.sha1)`, `SHA-256 (.sha256)` —
  drives both the hash computed on Verify and the export format.
- **Base Path** toggle button — reveals a text input + "Apply to Entries" button that rewrites
  every loaded entry's path to `<base>/<filename>`, for when file paths arrived without a real
  directory (e.g. a browser `<input type="file">` selection with no Electron path resolution).
- **Add Files** — opens a native multi-file picker; each selected file becomes a
  `ChecksumEntry` with `status: 'COMPUTING'` and no expected hash.
- **Load SFV** — opens a picker restricted to `.sfv/.md5/.sha1/.sha256/.txt`. The component
  first attempts an in-browser parse (regex-based, to work without a backend round-trip when
  the browser already has the raw text); if that yields nothing it falls back to
  `sfvApi.parseSfv(path)` (a real backend parse — see §3). Dropping a recognized verification
  file (matched by extension) via the global drop zone routes it through
  `handleLoadSfvPath`, which always calls the backend parser.
- **Export SFV** — calls the backend `POST /sfv/export` and triggers a browser download of the
  returned text content, named `checksums.<ext>` (`sfv` for CRC32, else the lowercased hash
  type with the underscore stripped, e.g. `sha256`).
- **Verify Hashes** / **Cancel** — see §2.
- Clear-entries button (trash icon), shown once entries exist.

**Results table** columns: File Path, Expected Hash, Calculated Hash, Algorithm, Status. The
Status cell renders one of six badges: `OK` (green), `MISMATCH` (red), `CALC` (amber, spinning,
while `COMPUTING`), `MISSING` (amber), `ERROR` (red), or `WARNING` (orange, with a tooltip
"Computed hash does not match the checksum embedded in the filename" — see §4).

**Missing Files Warning modal:** after a verification pass, if any result entries came back
with `status === 'MISSING'`, a modal lists every missing path and requires an explicit "OK"
dismissal — it does not block the rest of the results from being shown underneath.

---

## 2. Real-time verification pipeline

**Request/response contract** (`POST /api/v1/sfv/verify`):

```java
public record ChecksumVerificationRequestDto(
    List<String> filePaths, HashType hashType, String sfvFilePath,
    Map<String, String> expectedHashes) implements Serializable {}
// 3-arg compact constructor (filePaths, hashType, sfvFilePath) defaults expectedHashes to null,
// for callers that only want server-side-loaded expectations.

public record ChecksumVerificationResultDto(String taskId, List<ChecksumEntryDto> entries)
    implements Serializable {}
```

`expectedHashes` is a `path -> expected hash` map built client-side from whatever the frontend
already has loaded (parsed SFV entries, or manually typed expected hashes) — this works even
when the loaded verification file isn't accessible to the backend (e.g. it came from a browser
file picker with no real path). If `expectedHashes` is omitted/null, the backend instead loads
expectations itself via `parseVerificationFile(request.sfvFilePath())` (§3), keyed the same way.

**`ChecksumServiceImpl.startVerificationTask(request)`** (fully synchronous — see spec 00 §5):

1. Mint a `taskId` (`UUID.randomUUID()`, used only to correlate WebSocket progress frames with
   this call, not for later lookup — see §5 on cancellation).
2. Map the backend `HashType` to the real legacy `net.filebot.hash.HashType`
   (`CRC32→SFV, MD5→MD5, SHA_1→SHA1, SHA_256→SHA256`, default `SFV`).
3. For every file path, in order:
   - If the file doesn't exist: `ChecksumStatus.MISSING`, no calculated hash.
   - Otherwise, compute the real digest via
     **`net.filebot.hash.VerificationUtilities.computeHash(file, legacyHashType)`** — chunked
     read using `FileUtilities.BUFFER_SIZE` internally, real `CRC32`/`MessageDigest`
     implementation per `net.filebot.hash.HashType.newHash()`. Compare (case-insensitively)
     against the expected hash if one was supplied → `OK` or `MISMATCH`; if no expected hash
     was supplied, default to `OK` (then possibly downgraded to `WARNING` — see §4). Any
     exception while hashing → `ChecksumStatus.ERROR`.
   - Publish one `ChecksumProgressEventDto(taskId, path, file.length(), file.length(), 0.0,
     100.0 * processed / total, entry)` to `/topic/sfv/progress` via the injected
     `TaskProgressPublisher`, so a subscribed client sees per-file progress in real time while
     this loop is still running on the request thread. (`bytesProcessed` is currently reported
     as the full file length rather than true intra-file progress, and `MBps` is always `0.0` —
     accurate enough to drive a per-file progress list, not a byte-level progress bar or speed
     gauge; improving that would mean instrumenting `computeHash` itself, which is legacy code
     called as-is rather than modified.)
4. Return `ChecksumVerificationResultDto(taskId, results)` once every file has been processed.

The frontend's `handleVerify` sends `expectedHashes` built from whatever `expectedHash` values
are already present on its `entries` state, receives the result list back, and merges it onto
its rows by path (`byPath.get(entry.path) ?? entry`) — it never computes or fabricates a hash
itself.

---

## 3. Parsing verification files (`GET /api/v1/sfv/parse`)

`parseVerificationFile(sfvFilePath)` no longer assumes every file is SFV/CRC32-formatted. It
dispatches on the real file extension via
**`net.filebot.hash.VerificationUtilities.getHashType(File)`**, which returns the matching
legacy `HashType` (`SFV`, `MD5`, `SHA1`, `SHA256`, or `SHA3_384`) by extension, then uses that
type's own `VerificationFormat` (`SfvFormat` for `.sfv`, plain `VerificationFormat` with a hash
hint for the others) to drive `net.filebot.hash.VerificationFileReader` over the real file
content. Each parsed `(path, hash)` pair becomes a `ChecksumEntryDto` with `status: COMPUTING`
and the correctly mapped backend `HashType` (via `toBackendHashType`, which folds `SHA3_384`
into `SHA_256` since the backend enum has no distinct SHA3 value). A `.md5`/`.sha1`/`.sha256`
file is therefore parsed correctly now — previously the hardcoded `new SfvFormat()` meant its
regex never matched and the file silently produced zero entries.

---

## 4. Embedded-checksum cross-check (WARNING status)

When **all** of the following hold for a given file:
- `hashType == CRC32` (the embedded-checksum convention is CRC32-only, 8 hex digits),
- no expected hash was supplied for that path (no loaded SFV entry covers it), and
- the computed hash would otherwise be reported `OK`,

the service additionally checks `net.filebot.hash.VerificationUtilities.getEmbeddedChecksum
(file.getName())` — a regex matching an 8-hex-digit value enclosed in `[...]` or `(...)`
anywhere in the filename (the common release-scene convention, e.g.
`Movie.Title.2020.1080p-GROUP[49A93C5F].mkv`). If a checksum is embedded and it does **not**
match the freshly computed hash, the status is downgraded from `OK` to `ChecksumStatus.WARNING`
instead. This is purely additive: it can only ever change an `OK` into a `WARNING`, never
override a real `MISMATCH` against an explicitly loaded expected hash, and it never runs at
all for non-CRC32 algorithms (a MD5/SHA digest is never 8 hex characters, so comparing it
against an 8-hex embedded value would always mismatch spuriously if the guard weren't there).

---

## 5. Cancellation — a documented no-op

`ChecksumService.cancelVerificationTask(taskId)` does nothing:

```java
@Override
public void cancelVerificationTask(String taskId) {
  // Verification currently runs synchronously within startVerificationTask's request/response
  // cycle, so there is nothing in-flight on the server to cancel by the time a cancel request
  // arrives.
}
```

This is intentional, not an oversight. Because `startVerificationTask` blocks the request
thread until every file has been hashed, by the time a client could react to slow progress and
issue a cancel call, the original request has almost always already completed and returned.
The frontend still wires a Cancel button (`handleCancelVerification`) that calls this endpoint
and locally marks any still-`COMPUTING` rows as `MISSING`, but the button is mostly meaningful
today as a "give up waiting on this UI, treat the pending entries as unresolved" affordance,
not a true kill-switch on server-side work. Real cancellation would require the background
task/executor model described as a known limitation in spec 00 §5.

---

## 6. Exporting a verification file (`POST /api/v1/sfv/export`)

```java
public record ChecksumExportRequestDto(
    List<ChecksumEntryDto> entries, HashType hashType, String outputPath)
    implements Serializable {}
```

`generateVerificationFileContent` maps `hashType` to the legacy type exactly as in §2, then
uses that type's own `VerificationFormat.format(path, hash)` to build each line — `SfvFormat`
produces `"path hash"` (e.g. `video.mkv 8A4F32C1`), the plain `VerificationFormat` produces the
hash-first, tool-standard layout for MD5/SHA1/SHA256 (`"hash *path"`-style, matching what
`md5sum`/`sha1sum`/`sha256sum -c` and FileBot's own parser both expect). Previously every hash
type was exported through one hand-built `"path hash\n"` line, so MD5/SHA/SHA256 exports were
SFV-shaped and unreadable by standard tools or by this app's own importer. If `outputPath` is
supplied, the content is additionally written server-side (best-effort — a write failure is
swallowed since the generated string is returned to the caller regardless).

---

## 7. Known Gaps / Deliberately Deferred

- **No background task queue / genuine cancellation.** Architectural decision, not a bug — see
  spec 00 §5. A future contributor wanting real cancel-mid-batch behavior needs a task
  registry and cancellation tokens, plus a client-side reconnect/polling story, not just a
  bigger thread pool.
- **No true byte-level progress or throughput.** `ChecksumProgressEventDto.bytesProcessed` is
  reported as the whole file's length (not incremental within a large file) and `MBps` is
  always `0.0`; a real speed gauge would require instrumenting the read loop inside
  `VerificationUtilities.computeHash` itself.
- **`WARNING` has no dedicated visual highlighting beyond its status badge.** Legacy's
  `HighlightPatternCellRenderer` visually distinguishes filenames with an embedded checksum in
  the row itself (independent of verification status); here the cross-check exists and is
  correctly wired, but there's no separate "this filename has an embedded checksum" indicator
  outside of the `WARNING` badge that only appears on an actual mismatch.
- **No OpenSubtitles-hash (`HashType.OPENSUBTITLES`) path through this UI.** That hash type
  exists in the domain enum (used by the Subtitles feature, spec 05) but `SfvPanel`'s algorithm
  selector only ever offers CRC32/MD5/SHA-1/SHA-256.
