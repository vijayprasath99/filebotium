# FileBot Swing→React/Spring Boot Port — Comprehensive Parity Audit

**Date:** 2026-09-19
**Scope:** Full UI-to-backend wiring parity and backend execution parity audit between
the legacy desktop application (`src/main/java/net/filebot/**`, primarily **Java
Swing**, `javax.swing.*` — see terminology note below) and the in-progress port
(`frontend/` React 18 + TypeScript, `src/main/java/net/filebot/backend/**` Spring Boot
3, packaged in `desktop-wrapper/` Electron).
**Companion documents:** `specs/audit/00_CROSSCUTTING_FINDINGS.md` and eight per-area
audit files (`01_appshell_and_navigation_audit.md` through `09_settings_audit.md`,
`02_03_rename_format_audit.md` covers two areas) contain the full, unabridged
evidence this report consolidates. This document is self-contained (every gap is
reproduced here with its source citations and severity), but the per-area files
should be treated as the permanent record of methodology and are referenced
throughout.

---

## 1. Executive Summary

**Headline finding, true across every one of the eight areas audited:** the previous
implementation pass built a plausible, spec-shaped **skeleton** — React components,
TypeScript types, Spring Boot controllers, DTOs, and enums that all match the wire
contracts documented in `specs/00`–`specs/09` — but in the large majority of cases the
**service-layer business logic underneath that skeleton is a stub, a fabrication, or a
silent no-op, not a functioning port of the legacy logic.** This is not primarily a
story of "missing buttons" (though there are real instances of that too); it is a
story of buttons and endpoints that exist, are wired to each other, and return
plausible-looking fake data.

Concrete examples of this pattern, one from every area:

| Area | What looks done | What actually happens |
|---|---|---|
| Rename Workspace | `POST /api/v1/rename/match` accepts provider/mode/language and returns scored matches | `RenameWorkspaceServiceImpl.autoMatch()` never queries any metadata provider; every match gets a **hardcoded score of 0.85** and `targetMetadata=null` ([`RF-01`](#2-rename-workspace--matching-engine)) |
| History/Rollback | "Undo" button calls a rollback endpoint and reports success/failure | `HistoryServiceImpl.rollbackTransaction()` never moves a file — it just checks `File.exists()` and reports fake success ([`Gap 2`](#7-history--transaction-rollback)); renames executed via the new UI are **never written to history in the first place** ([`Gap 3`](#7-history--transaction-rollback)) |
| SFV Checksums | Verify button shows a progress bar and OK/MISMATCH badges | `ChecksumServiceImpl.startVerificationTask()` is `return UUID.randomUUID().toString();` — no file is ever hashed; **React fabricates a random hex string as the "calculated hash"** client-side ([`GAP-01`/`GAP-02`](#4-sfv-verification--checksum-hashing)) |
| Subtitles | Search/Download buttons return results and report downloaded files | `SubtitleServiceImpl` never calls OpenSubtitles or Shooter; search results are synthesized filenames, and download **writes no file to disk** while reporting success ([`G1`–`G4`](#3-subtitles-search--downloader)) |
| Analyze Panel | Archives / Parts / Attributes / Types tabs render data | Three of five tabs are 100% client-side regex/string fakes with **zero backend method** behind them ([`AN-1`–`AN-4`](#5-analyze-panel--mediainfo-inspector)) |
| Settings | Provider credentials save "encrypted" | Stored in **plaintext**, contradicting the spec's own claim ([`S-7`](#8-settings--preferences)) |
| App Shell | Real-time progress/notification WebSocket topics are subscribed | Nothing in the entire backend ever publishes to them — `TaskProgressPublisher` has **zero callers anywhere** ([`X1`](#cross-cutting-findings)) |
| Navigation | Sidebar has a "List" tab | It renders the **History/rollback panel**; the real legacy List (sequence-generator) feature has no React implementation at all, and there is no tab labeled "History" anywhere ([`X3`/`AS-3`/`AS-4`](#cross-cutting-findings)) |

**Severity distribution:** of the ~85 individually numbered gaps found across all
areas, the large majority are rated **BROKEN_FUNCTIONALITY** or
**DATA_INTEGRITY_RISK** — very few are COSMETIC. Several findings are rated
DATA_INTEGRITY_RISK specifically because they are **worse than a missing feature**:
they actively report false success to the user (fake checksum verification, fake
rollback success, fake subtitle download success), which is more dangerous than an
obviously-broken button because the user has no signal that anything is wrong.

**A secondary, recurring finding:** in several places the *spec documents itself*
(`specs/01` through `specs/09`, authored by a prior AI pass) describe legacy behavior
that does not exist in the actual Swing source — an invented `ConflictStrategy
.AUTO_RENAME`, an invented Analyze-panel search bar, an invented Settings
cache-clear confirmation modal, an inaccurate History XML schema, a mischaracterized
clipboard-paste handler. These are flagged explicitly throughout and must not be
treated as implementation gaps to silently build against — see
[§10 Spec Accuracy Corrections](#10-spec-accuracy-corrections-not-implementation-gaps).

**What is working correctly and should be preserved as a model for the rest:**
`StandardRenameAction` is correctly reused for real file MOVE/COPY/HARDLINK/SYMLINK
operations in `RenameWorkspaceServiceImpl.executeRename()`; `HistoryServiceImpl`
correctly reuses `HistorySpooler.getCompleteHistory()` for reads (just not writes);
`MediaInfoInspectorServiceImpl` correctly binds to the real native `libmediainfo` via
JNA rather than reimplementing inspection; `computeOpenSubtitlesHash` correctly ports
the legacy 64KB-block hash algorithm byte-for-byte; core Settings CRUD (get/update/
reset) is genuinely wired end-to-end; and **`EpisodeFetcherServiceImpl` genuinely
calls the real TheTVDB/TMDb/AniDB/TVMaze provider clients** rather than fabricating
results — it's broken today only by a placeholder API-key string and a hardcoded
locale, both one-line fixes, not a missing implementation. These are the exception,
not the rule, but they
prove the "port legacy Java directly into the service layer" strategy works when it's
actually applied — which is exactly what §9's reuse-opportunities catalog asks the
implementation team to do everywhere else.

---

## 2. Methodology

Eight parallel deep-dive audits were performed, one per functional area, each
independently reading (in full, not excerpted) the relevant legacy Swing source
(`net.filebot.ui.*` and supporting `net.filebot.*` business-logic packages), the
corresponding React component(s) (`frontend/src/components/*.tsx`), and the
corresponding Spring Boot controller **and service implementation** (not just service
interfaces/DTOs — implementations were read line-by-line to distinguish real logic
from stubs). Each area audit additionally grepped its legacy UI package for every
`JButton`/`JMenuItem`/`JPopupMenu`/`.addActionListener`/`KeyStroke`/drag-drop handler
to build an exhaustive interactive-element inventory beyond what each spec document's
own "Source Files Audited" list happened to mention, per the task's requirement not to
skip low-visibility elements (context menus, keyboard shortcuts, secondary dialogs).

A ninth cross-cutting pass (this document plus `00_CROSSCUTTING_FINDINGS.md`)
identified findings that recur across multiple areas — most importantly, that the
entire WebSocket progress-publishing pipeline (`TaskProgressPublisher`) is dead code
with zero callers anywhere in the backend, confirmed via repo-wide grep for
`SimpMessagingTemplate`/`convertAndSend`/`TaskProgressPublisher`.

**Terminology correction, applied throughout:** the legacy application's UI is
overwhelmingly **Java Swing** (`javax.swing.*`, MigLayout), not JavaFX. The only
genuine JavaFX usage is a single embedded `WebView` island in
`GettingStartedStage.java` for the onboarding help screen. Every "JavaFX source"
citation in this report and its companions refers to `net.filebot.ui.*` Swing code
unless explicitly marked otherwise.

Every gap below carries: an ID, a category (`a` = React UI element exists but is
dangling/disconnected from a real backend call; `b` = JavaFX/Swing element has no
React equivalent at all; `c` = a Spring Boot implementation exists but diverges from
legacy behavior/parameters/sequencing; `d` = a JavaFX/Swing operation has no
corresponding Spring Boot endpoint or service method at all), exact file:method/line
citations on both the legacy and ported sides, a description of the concrete
behavioral difference, and a severity (`BROKEN_FUNCTIONALITY`, `DATA_INTEGRITY_RISK`,
`COSMETIC`, or `MINOR`).

No source files were modified during the audit. All work is read-only research;
findings are reported here and in the per-area files for the implementation team to
act on per `specs/IMPLEMENTATION_PLAN.md`.

---

## Cross-Cutting Findings

*(Full detail: `specs/audit/00_CROSSCUTTING_FINDINGS.md`)*

**X1 — The entire WebSocket progress-publishing pipeline is dead code.**
`src/main/java/net/filebot/backend/websocket/TaskProgressPublisher.java`'s
`publishRenameProgress(...)` and `publishSfvProgress(...)` only append to a private
in-memory `List<Object>` that nothing ever reads, and neither method is called
anywhere in the backend (confirmed by repo-wide grep — zero callers). No
`SimpMessagingTemplate`/`.convertAndSend(...)` call exists anywhere in
`net.filebot.backend`. `WebSocketConfig` correctly registers the STOMP broker and the
frontend (`websocketClient.ts`) correctly auto-subscribes to `/topic/rename/progress`,
`/topic/sfv/progress`, `/topic/notifications` — but nothing server-side ever publishes
to any of them. Every real-time progress UI in specs 00/02/06 is non-functional by
construction. **Severity: BROKEN_FUNCTIONALITY.**

**X2 — File intake silently drops recursion/hidden-file filtering, and the frontend
discards the backend's response anyway.**
`AppShellController.processFileIntake()` reads `IntakeRequestDto.recursive`/
`.filterHidden` into the DTO but never references either field — no directory
recursion, no `.DS_Store`/`Thumbs.db`/`desktop.ini` filtering. Independently,
`AppShell.tsx`'s `handleFilesDropped` calls `appApi.intakeFiles(...)` but only
`.catch()`s it — the resolved `acceptedFiles` value is never used; `droppedFiles`
state is populated straight from raw OS drag-event paths. Both bugs would need fixing
for either to matter. **Severity: BROKEN_FUNCTIONALITY** (breaks the basic "drop a
season folder" workflow).

**X3 — The sidebar's "List" tab renders History; the real List feature has zero
port.** `net.filebot.ui.list.ListPanel` (a Groovy-pattern-driven sequence generator
with From/To spinners, Load/Save, and a "Send to" context menu — completely unrelated
to rename history) is the legacy panel actually named "List"
(`PanelBuilder.defaultSequence()` registers it as the sixth top-level tab). The React
port instead renders `HistoryPanel` (rollback/undo UI) under the sidebar tab labeled
"List" with a magic-wand icon (`AppShell.tsx:167`, `SidebarNav.tsx:31`). There is no
tab, menu item, or label anywhere in the React app that says "History." Full detail:
[§7](#7-history--transaction-rollback) gaps `AS-3`/`AS-4` (App Shell) and `1` (History).
**Severity: BROKEN_FUNCTIONALITY** (History is a data-integrity-critical feature
reachable only by accident; the real List tool is 100% absent).

---

## 3. Consolidated Gap List by Area

### 1. App Shell, Navigation & Global Drag-and-Drop
*(specs/01 — full detail: `specs/audit/01_appshell_and_navigation_audit.md`)*

| ID | Cat | Legacy source | React/Spring source | Description | Severity |
|----|-----|---------------|----------------------|-------------|----------|
| AS-1 | d | `websocket/TaskProgressPublisher.java` | same file | Dead WS publisher, see X1. | BROKEN_FUNCTIONALITY |
| AS-2 | a | `NotificationHandler.java` (global log→toast bridge) | `websocketClient.ts` subscribes to `/topic/notifications` but **no component ever registers a callback for it**; `AppShell.tsx`'s only notification state is local to the Undo button | No working equivalent of "any backend warning/error becomes a toast" exists; compounds X1. | BROKEN_FUNCTIONALITY |
| AS-3 | b | `PanelBuilder.defaultSequence()` (`ui/PanelBuilder.java:20-29`) — 6 tabs incl. real `ListPanelBuilder` (Groovy sequence generator, 270-line `ListPanel.java`) | No `ListPanel.tsx` exists anywhere; `AppShell.tsx:167` renders `<HistoryPanel/>` for `'LIST'` | See X3. | BROKEN_FUNCTIONALITY |
| AS-4 | a | History is **not** a top-level legacy panel — only reachable via `ui.rename.HistoryDialog`, a modal launched from inside RenamePanel | `HistoryPanel.tsx` exists but is reachable only via the mislabeled "List" tab; no button anywhere says "History" | See X3. | BROKEN_FUNCTIONALITY |
| AS-5 | c | `ui/transfer/DefaultClipboardHandler.java` implements **only copy-out** (Ctrl+C), not paste-in; spec 01 §A's claim of a Ctrl+V import handler is unverified/likely mischaracterized (no `VK_V`/paste-action wiring found anywhere) | No paste/clipboard-import handling anywhere in React | Ambiguous — see §9 item AMB-AS1; spec may be inaccurate, but React has zero paste-import regardless. | MINOR (pending verification) |
| AS-6 | b | `MainFrame.PanelSelectionList.DragDropListener` (lines 234-277): dragging files over a *different* tab entry live-previews/switches to it | `SidebarNav.tsx` tab buttons have no `onDragEnter`/`onDragOver` handlers | Drag-hover-to-preview-switch convenience missing (legacy's actual `drop()` on the tab list is itself a no-op — only the hover-preview is lost). | COSMETIC |
| AS-7 | b | `MainFrame.java:109-160` — Ctrl+Shift+Delete=Clear Cache, F5=GroovyPad REPL, F1=Help | `AppShell.tsx` only wires Ctrl+1..6 and Ctrl+Shift+D (new Dev Logs feature, fine) | GroovyPad is a legitimate product decision (RCE surface once networked) — see §9 AMB-AS2. Clear-Cache/F1-Help are plain gaps. | MINOR |
| AS-8 | c | Spec 01 §A: recursive expansion + hidden/system-file filtering; spec 01 §B: `{acceptedFiles, rejectedCount}` response envelope | `AppShellController.java:35-60` ignores `recursive`/`filterHidden`; returns flat array not the spec's envelope; `GlobalDropZone.tsx`+`AppShell.tsx:72-80` discard the intake response entirely | See X2. | DATA_INTEGRITY_RISK |
| AS-9 | b/d | `GettingStartedStage.java`+`GettingStartedUtil`+`Main.java:326-337` first-run onboarding WebView | No onboarding flow anywhere in React | — | MINOR |
| AS-10 | b | `FileBotMenuBar.createHelp()` (Getting Started/FAQ/Forums/Discord/Report Bugs/Request Help), macOS-only attach point | No Help menu/links anywhere | — | COSMETIC |
| AS-11 | b | `SupportDialog.AppStoreReview` — Mac App Store review nag, gated on `isAppStore()` | None; likely N/A since packaging is Electron-only (specs/10) | Recommend explicit "will not port" sign-off rather than silent gap. | COSMETIC / not-applicable |
| AS-12 | — | `PanelBuilder.fileHandlerSequence()=[Rename,Sfv,List]`, `episodeHandlerSequence()=[Rename,List]`, `textHandlerSequence()=[Rename]` | informational | Ground truth for "Send to" menus used by Analyze/List gap analysis elsewhere — "Send to List" has no destination until AS-3 is fixed. | n/a |

### 2. Rename Workspace & Matching Engine + Groovy Format Expression Engine
*(specs/02 + specs/03 — full detail: `specs/audit/02_03_rename_format_audit.md`)*

**This is the single most severe area in the whole audit — it is the app's core
value proposition and it does not work.**

| ID | Cat | Legacy source | React/Spring source | Description | Severity |
|----|-----|---------------|----------------------|-------------|----------|
| RF-01 | d | `RenamePanel.createFetchPopup()`→`EpisodeListMatcher`/`MovieMatcher`/`MusicMatcher`/`AutoDetectMatcher`→`net.filebot.similarity.Matcher`+`EpisodeMetrics`, via `WebServices.getEpisodeListProviders()`/`.getMovieIdentificationServices()` | `RenameWorkspaceServiceImpl.autoMatch()` (lines 29-77) | **Never queries any metadata provider.** Every match gets `targetMetadata=null` and a **hardcoded score of 0.85**; `provider`/`mode`/`language` request fields are read but unused. `SeasonEpisodeMatcher` field is instantiated and never referenced (dead code). The core "match against TheTVDB/TMDb/etc." feature is a pass-through stub. | BROKEN_FUNCTIONALITY |
| RF-02 | c | `RenameModel.getRenameMap()`/`MatchFormatter.format(match,...)` binds against the real fetched Episode/Movie object | `RenameWorkspaceServiceImpl.autoMatch()`/`.applyFormat()` | Because `targetMetadata` is always null (RF-01), every binding resolves `(file,file,null)` instead of `(episode/movie,file,context)` — expressions can never show real titles/season/episode/air-dates. | BROKEN_FUNCTIONALITY |
| RF-03 | d | `RenameAction.actionPerformed()`→`HistorySpooler.getInstance().append(...)` (`RenameAction.java:142`) | `RenameWorkspaceServiceImpl.executeRename()` (lines 142-190) | Real file moves happen via `StandardRenameAction` (good reuse) but **no history is ever written**. Undo/Rollback is silently unavailable after every successful rename. Single most severe data-integrity gap in the app. Confirmed independently from the History-area audit (`Gap 3`). | DATA_INTEGRITY_RISK |
| RF-04 | c | `RenameAction.validate()`→`ValidateDialog`(illegal chars)→`ConflictDialog`(Cancel/Continue=skip/Override=trash+overwrite) | `RenameWorkspace.tsx` hardcodes `'OVERWRITE'`; `RenameWorkspaceServiceImpl.executeRename()` **never reads `request.conflictStrategy()` at all** | No conflict-resolution or path-validation UI exists in React; even the one strategy value sent is ignored server-side. | DATA_INTEGRITY_RISK |
| RF-05 | b | `RenamePanel` "Exclude Selected Items" (both lists + Delete key, `FileBotList.getRemoveAction()`) | `MatchTableContainer.tsx` (the live component) has **no** per-row exclude control; a separate unused `MatchTable.tsx` implements it but is never imported anywhere (confirmed via grep) | Backend honors `Match.isExcluded` correctly — nothing in the live UI can ever set it. | BROKEN_FUNCTIONALITY |
| RF-06 | b | `RenamePanel.installKeyStrokeActions()`: F2=manual rename override, 1-9=apply Preset, F7=copy debug info | None wired in React at all | F2 has **no substitute UI control anywhere** — no way to hand-correct one filename short of re-running the whole match. | BROKEN_FUNCTIONALITY (F2) / MINOR (F7) |
| RF-07 | b | `RenamePanel` Settings popup: Preserve/Override extension toggle; `KEEPLINK`/`CLONE`/`DUPLICATE`/`TEST` actions exist in `StandardRenameAction` beyond the 4 exposed | `MatchTableContainer.tsx` Action select has only MOVE/COPY/HARDLINK/SYMLINK, no extension toggle | Extension-handling is implicit/unverified; secondary actions absent. | MINOR |
| RF-08 | b | `RenamePanel` Fetch-Data popup: persistent Strict/Opportunistic match mode, preferred language, preferred episode order | `MatchTableContainer.tsx` has Mode/Provider selects but **no** match-strictness toggle, **no** language selector (hardcoded `'EN'`), no episode-order selector | Non-English users cannot match in their language from this panel. | MINOR |
| RF-09 | b | Double-click a New-Names row opens `FormatDialog` pre-bound to that row's real matched object (`RenamePanel.java:320-339`) | `MatchTableContainer.tsx` rows only support selection, no double-click handler | Loses per-match format tuning; compounds RF-02 (no real metadata to preview anyway). | BROKEN_FUNCTIONALITY |
| RF-10 | b | `FormatDialog`: 4 independent Modes w/ own persisted history, live Groovy syntax highlighting, Change Sample/Change Folder, recent-format popup | `FormatEditorModal.tsx` is a single hardcoded "Episode Format" modal, plain `<input>`, static example list, no independent per-type state, no sample/folder picker | Simplified reimplementation, not a port. | COSMETIC/MINOR |
| RF-11 | b | `RenamePanel.createPresetsPopup()`/`PresetEditor.java`/`Preset.java` — full preset CRUD, apply via 1-9; spec 03 §D explicitly requires a "Preset Manager Modal" | **No component anywhere implements this** (grep: zero "preset" references in any `.tsx`); **no `PresetController`/`PresetService` exists at all** | Entire feature missing end-to-end, both layers. One of the biggest feature omissions in the whole app. | BROKEN_FUNCTIONALITY |
| RF-12 | b | `RenamePanel.openHistoryAction` toolbar button opens `HistoryDialog` w/ inline right-click Revert, Import(.xml), Export, live filter | No "Open History" entry point inside the Rename workspace at all | Compounds RF-03/History gaps — even if history worked, no quick-access from Rename itself. | DATA_INTEGRITY_RISK |
| RF-13 | b | Double-click Original-Files row → `UserFiles.revealFiles()` (OS file manager) | No equivalent; no Electron IPC bridge exists for it (`preload.js` only exposes `getPath`) | Needs a new IPC channel to be possible at all. | MINOR |
| RF-14 | c | `MatchAction`/`RenameList` "Align Up/Down" = true adjacent swap | `RenameWorkspaceServiceImpl.updateRowAlignment()` does remove+insert (net-equivalent for adjacent indices only) | Not a functional bug today; diverges from documented contract for non-adjacent indices (drag-reorder, which also doesn't exist in React). | COSMETIC |
| RF-15 | d | `BindingDialog`/`FormatDialog.createExamplesPanel()` evaluate live against the real `MediaBindingBean` (1128 lines, dozens of bindings) | `FormatExpressionEngineServiceImpl.getAvailableBindings()` returns a **hardcoded 8-item list** regardless of input arguments (both accepted but unused) | Spec itself under-documents the binding catalog too (13 vs. real dozens) — see §10. | BROKEN_FUNCTIONALITY |
| RF-16 | a | n/a | `BindingPicker.tsx` fully implemented but **never imported/rendered anywhere** (confirmed via grep) | Dangling orphan component; duplicated effort vs. `EpisodeBindingsModal.tsx`. | COSMETIC |
| RF-17 | c | n/a (new addition) | `RenameWorkspace.tsx` "Base Folder Override" text input works around browser File API path limits | Suggests the Electron path bridge (specs/01 §D) isn't fully trusted — worth double-checking once AS-8/X2 are fixed; also a footgun (wrong-directory rename risk). | MINOR |

### 3. Subtitles Search & Downloader
*(specs/05 — full detail: `specs/audit/05_subtitles_audit.md`)*

| ID | Cat | Legacy source | React/Spring source | Description | Severity |
|----|-----|---------------|----------------------|-------------|----------|
| G1 | c | `SubtitleAutoMatchDialog` — "Exact"=hash-based (`lookupSubtitlesByHash`), "Fuzzy"=name-based (`findSubtitlesByName`); both run in parallel against the same account | `SubtitlePanel.tsx:106-142` maps Exact/Fuzzy to `provider=OPEN_SUBTITLES`/`SHOOTER` instead | `SubtitleServiceImpl.searchSubtitles` ignores `provider` for behavior — both buttons hit the identical fabricated code path; neither real strategy exists. | BROKEN_FUNCTIONALITY |
| G2 | d | `OpenSubtitlesClient`/`OpenSubtitlesXmlRpc` real XML-RPC calls | `SubtitleServiceImpl.searchSubtitles` (lines 37-57) | Fabricates one descriptor per input path (`filename+".srt"`, fake `subtitles.filebot.net` URL, hardcoded `score=0.90`) — **no real search ever happens.** | BROKEN_FUNCTIONALITY |
| G3 | d | `ShooterSubtitles` — real 4-block-MD5 hash + API call | No reference anywhere in `SubtitleServiceImpl` | Shooter is a first-class selectable option end-to-end but silently returns fabricated OpenSubtitles-shaped results instead. | DATA_INTEGRITY_RISK |
| G4 | c | `SubtitleAutoMatchDialog.DownloadTask` — real fetch + `SubtitleNaming.format()` + `writeFile()` | `SubtitleServiceImpl.downloadSubtitles` (lines 59-75) | **No I/O at all.** String-replaces the extension to `.srt` and reports success unconditionally — the success toast always lies. | DATA_INTEGRITY_RISK |
| G5 | d | `SubtitleNaming` enum controls real output filename | Naming dropdown state is never sent in the download request; DTO has no field for it | 100% cosmetic dropdown. | BROKEN_FUNCTIONALITY |
| G6 | b | `SubtitleUploadDialog.java` (full class) — video/subtitle/IMDb/language table, CD-grouping | No upload component/method exists anywhere in React (`client.ts` has no `uploadSubtitle`) | `SubtitleServiceImpl.uploadSubtitle` is a literal no-op comment. Spec §D explicitly requires this. | BROKEN_FUNCTIONALITY |
| G7 | b | `SubtitlePanel.java:297-415` OpenSubtitles login/VIP-quota modal | No auth modal anywhere | Moot until G2 fixed, but explicitly speced and 100% absent. | BROKEN_FUNCTIONALITY |
| G8 | b | Right-click context menu: Preview/Save As/Export on downloaded subtitles | No context menu, no `SubtitlePreviewModal` anywhere | — | COSMETIC |
| G9 | b | Two distinct circular drop targets (upload vs. download) | Single generic file picker only | Consistent with G6 being fully missing. | MINOR |
| G10 | c | 16-value `LanguageCode` + "All Languages" sentinel | `<select>` hardcodes only 4 languages (EN/DE/FR/ES), no "All" option | — | MINOR |
| G11 | c | Download always uses the matched subtitle's real originating provider | `handleDownload` hardcodes `provider:'OPEN_SUBTITLES'` regardless of `row.descriptor.provider` | Latent bug, becomes live once G2/G3 fixed. | MINOR |
| G12 | c | Search returns `Map<File,List<Descriptor>>`, explicit per-video candidate lists | Flat `SubtitleDescriptorDto[]`, frontend assumes positional `results[i]↔rows[i]` correspondence | **No `videoFilePath` field on the DTO at all** — structurally impossible to correctly attribute multiple real candidates once the backend is fixed for real. | DATA_INTEGRITY_RISK |

*(One thing working correctly: `computeOpenSubtitlesHash` genuinely reuses the legacy 64KB-block hash algorithm byte-for-byte.)*

### 4. SFV Verification & Checksum Hashing
*(specs/06 — full detail: `specs/audit/06_sfv_audit.md`)*

| ID | Cat | Legacy source | React/Spring source | Description | Severity |
|----|-----|---------------|----------------------|-------------|----------|
| GAP-01 | d | `ChecksumComputationService`/`ChecksumComputationTask` — real chunked CRC32/MD5/SHA1/SHA256 hashing | `ChecksumServiceImpl.startVerificationTask` (lines 24-30) | Method body is `return UUID.randomUUID().toString();` — **no hash is ever computed, no file I/O at all.** | BROKEN_FUNCTIONALITY |
| GAP-02 | a | n/a (legacy always reports real digests) | `SfvPanel.tsx:213-238 handleVerify` | After the fake taskId, React waits 1200ms then **fabricates the result**: if `expectedHash` exists, `simulatedHash` is forcibly set equal to it (always "OK" by construction); otherwise a **random hex string** is generated. Real mismatches can never surface. | DATA_INTEGRITY_RISK |
| GAP-03 | b/d | `TotalProgressPanel` (speed/ETA/progress) | No `SpeedGauge`/`TotalProgressBar`/`ETAIndicator` markup exists at all in `SfvPanel.tsx`; never subscribes to `/topic/sfv/progress` | Spec §C's entire progress header is absent, not just non-functional. | BROKEN_FUNCTIONALITY |
| GAP-04 | c/d | n/a | `TaskProgressPublisher.publishSfvProgress` | Not wired to any STOMP broker even in principle (no `SimpMessagingTemplate` anywhere in backend) — see X1. | BROKEN_FUNCTIONALITY |
| GAP-05 | d | `ChecksumComputationExecutor extends ThreadPoolExecutor`, one pool per root | No concurrency primitive of any kind in the backend (grep confirms zero `@Async`/`ExecutorService`/`CompletableFuture`) | Spec's `hashingExecutor` bean is never declared/used. | BROKEN_FUNCTIONALITY |
| GAP-06 | d | `hash/HashType.newHash()`→`ChecksumHash`(CRC32)/`MessageDigestHash`(MD5/SHA1/SHA256/SHA3-384) | `ChecksumServiceImpl` (whole file) | **Zero hash-computation code of any kind** — no `CRC32`, no `MessageDigest`, none of `net.filebot.hash.*` referenced. | BROKEN_FUNCTIONALITY |
| GAP-07 | c | `VerificationUtilities.getHashType(File)` picks `SfvFormat`(8-hex) vs `VerificationFormat`(MD5/SHA1/SHA256, variable-length hash-first) per extension | `ChecksumServiceImpl.parseVerificationFile` (lines 37-66) **hardcodes `new SfvFormat()`** regardless of file extension | Parsing a `.md5`/`.sha1`/`.sha256` file silently returns an empty list (regex never matches, exception swallowed per-line) — every entry also hardcoded to `HashType.CRC32`. | BROKEN_FUNCTIONALITY |
| GAP-08 | c | `VerificationFileWriter`+`VerificationFormat.format`(`"%s %s*%s"` MD5/SHA1/SHA256) vs `SfvFormat.format`(`"%s %s"` CRC32) + 3-line header | `ChecksumServiceImpl.generateVerificationFileContent` (lines 69-91) hand-builds `"path hash\n"` for **every** hash type | MD5/SHA1/SHA256 exports produce SFV-shaped output unreadable by `md5sum -c` etc. or FileBot's own parser; header collapsed to 1 line. | DATA_INTEGRITY_RISK |
| GAP-09 | d | `ChecksumComputationService.reset()` — real `shutdownNow()`+`Future.cancel()` | `ChecksumServiceImpl.cancelVerificationTask` (lines 32-35) | Method body is `// No-op for task cancellation`. Nothing to cancel anyway (consistent with GAP-01/05). | BROKEN_FUNCTIONALITY |
| GAP-10 | b | Spec §D.2 Missing Files Warning Modal | No modal, no `File.exists()` check anywhere on either side; `MISSING` status is repurposed client-side to mean "cancelled," not "absent" | — | BROKEN_FUNCTIONALITY |
| GAP-11 | c | `StateIconCellRenderer` | Spec says MISSING=Yellow; React renders it grey | — | COSMETIC |
| GAP-12 | b | `HighlightPatternCellRenderer`+`VerificationUtilities.EMBEDDED_CHECKSUM` — highlights/cross-checks CRC32 embedded in filename (e.g. `Test[49A93C5F].txt`), distinct `WARNING` row state | Entirely unported; React has no `WARNING` status concept at all | — | MINOR |

### 5. Analyze Panel & MediaInfo Inspector
*(specs/07 — full detail: `specs/audit/07_analyze_audit.md`)*

| ID | Cat | Legacy source | React/Spring source | Description | Severity |
|----|-----|---------------|----------------------|-------------|----------|
| AN-1 | d | `ExtractTool.java` — real archive listing (`Archive.open().listFiles()`) + background `ExtractWorker` | `AnalyzePanel.tsx:397-415` "Archives" tab only regex-filters filenames client-side; clicking a row wrongly routes to the MediaInfo inspector | No entry listing, no Extract button, **no backend method exists at all** for archives. | BROKEN_FUNCTIONALITY |
| AN-2 | d | `SplitTool.java` — real MB-based bin-packing into "Disk N" groups w/ editable split-size spinner | `AnalyzePanel.tsx:417-435` "Parts" tab just regex-matches filenames that already look like pre-split parts | No size-based grouping exists; no backend method. | BROKEN_FUNCTIONALITY |
| AN-3 | d | `AttributeTool.java` — real OS xattr / FileBot rename-metadata via `XattrMetaInfo` | `AnalyzePanel.tsx:437-450` "Attributes" tab parses filename/path strings client-side | `MediaFileDto.xattrs` is hardcoded to `Collections.emptyMap()` in `AppShellController` — no backend path exists at all. | BROKEN_FUNCTIONALITY |
| AN-4 | d | `TypeTool.java` — real content-sniffing classification via `MediaDetection` (Movie/Episode/Disk Folder/Clutter) | `AnalyzePanel.tsx` groups by filename extension only, `size` field is literally the string `"N file(s)"` not a byte count | No classification method exists server-side. | BROKEN_FUNCTIONALITY |
| AN-5 | a | `FileTree.RevealAction`→`UserFiles.revealFiles()` (opens OS file manager) | Menu items only call a text-banner `showStatus(...)`; no Electron IPC bridge exists (`preload.js` only exposes `getPath`) | Fully dangling no-op. | BROKEN_FUNCTIONALITY |
| AN-6 | b | `FileTree.TrashAction` "Move to Trash" | Missing entirely, also undocumented in spec §C | — | MINOR |
| AN-7 | b | `MediaInfoTool` full multi-file comparison matrix | `analyzeApi.batchInspect` exists and works but is **never called** from `AnalyzePanel.tsx` | Working batch endpoint sits unused. | COSMETIC |
| AN-8 | c | Real MediaInfo `HDR_Format`/`HDR_Format_Compatibility` keys | `MediaInfoInspectorServiceImpl.java:58` reads `colour_primaries` instead | Spurious "HDR" badges on wide-gamut SDR content; true Dolby Vision/HDR10+ undetected. | DATA_INTEGRITY_RISK |
| AN-9 | c | `MediaInfoException` — purpose-built native-lib-missing diagnostic | Generic `catch(Exception e)` (line 88) swallows it into the same blank result as any other failure | Spec's "Missing Native Library Warning" (§D) cannot ever surface. | DATA_INTEGRITY_RISK |
| AN-10 | c | `FileTreeTransferablePolicy.getTreeNode` — recursive walk + hidden-file filtering | Plain `<input multiple>` (no `webkitdirectory`); hardcodes `targetWorkspace:'LIST'` even inside the Analyze panel | Ties to X2; the `'LIST'` hardcode looks like a copy/paste bug (currently harmless only because the backend ignores the field). | MINOR today → BROKEN_FUNCTIONALITY once X2 is fixed |
| AN-11 | b | `PanelBuilder.fileHandlerSequence()`**confirmed** `= [Rename, SFV, List]` | `AnalyzePanel.tsx` "Send to" submenu matches exactly | Correctly wired for Rename/SFV. | MINOR |
| AN-12 | b | n/a (compounds App Shell) | "Send to → List" computes files and calls `onNavigateTab('LIST', files)`, but `AppShell.tsx:167` renders `<HistoryPanel/>` with no `files` prop — **selected files are silently discarded** | Direct consequence of X3/AS-3. | BROKEN_FUNCTIONALITY |
| AN-13 | — | n/a | n/a | Spec §A's claimed real-time filter/search bar **does not exist anywhere in the legacy source** — a spec-authoring invention, not an implementation gap. See §10. | n/a |

*(One thing working correctly: `MediaInfoInspectorServiceImpl` genuinely binds to the real native `net.filebot.mediainfo.MediaInfo` JNA library, confirmed via `build.gradle`'s `jna`/`jna-platform` dependencies — not a stub.)*

### 6. Episodes Explorer & Fetcher
*(specs/04 — full detail: `specs/audit/04_episodes_audit.md`)*

**This is the best-wired area in the whole audit** — unlike Rename/Subtitles/SFV,
`EpisodeFetcherServiceImpl` genuinely calls the real `TheTVDBClient`/`TMDbTVClient`/
`AnidbClient`/`TVMazeClient` provider classes rather than fabricating results. It is
still broken in production, but by configuration/parameter bugs rather than by being
an outright stub — a meaningfully cheaper class of fix than the other areas.

| ID | Cat | Legacy source | React/Spring source | Description | Severity |
|----|-----|---------------|----------------------|-------------|----------|
| EP-01 | c | `WebServices.java:52-64` is legacy's ground-truth provider wiring (`EpisodeListPanel.java:103-105`: `WebServices.getEpisodeListProviders()`), resolving real keys via `getApiKey("thetvdb")` etc. | `EpisodeFetcherServiceImpl.getProvider()` (lines 143-153) | **Every provider client is constructed with the literal placeholder string `"test-key"`**, never read from `WebServices`/`Settings`. Real API calls will be rejected (401/403/empty); both `searchSeries`/`getEpisodes` swallow the failure in a blanket `catch(Exception e){return emptyList();}`, so users just see "No TV series found." Also a smaller AniDB client-version mismatch (port uses `6`, legacy uses `7` — see §4 Ambiguous items). **Single most severe finding in this area, but the fix is a one-line swap per provider, not a rewrite.** | BROKEN_FUNCTIONALITY |
| EP-02 | c | `EpisodeListRequestProcessor.fetch()`/`.search()` (`EpisodeListPanel.java:190,194-208`) passes the user's selected `Locale` through to the provider on every call | `EpisodesExplorerPanel.tsx` correctly captures and forwards `language` through `episodeApi.searchSeries`/`.getEpisodes` | `EpisodeFetcherServiceImpl.searchSeries()` line 42 and `.getEpisodes()` line 79 both **hardcode `Locale.ENGLISH`**, ignoring `request.language()` entirely (the field is only echoed back cosmetically, line 99) | The language selector is fully wired end-to-end at the transport layer but dead at the point of use — every search/fetch is always performed in English regardless of user selection. | BROKEN_FUNCTIONALITY |
| EP-03 | c | `EpisodeListRequestProcessor.fetch()` filters by season **and** throws a distinct `SeasonOutOfBoundsException` (seriesName, requested, lastAvailable) when empty | `EpisodesExplorerPanel.tsx`'s `fetchEpisodesForSeries()` never passes the `season` argument at all (confirmed zero occurrences); filtering is done entirely client-side post-fetch after over-fetching the whole series | `EpisodeFetchRequestDto.seasonFilter()`/`EpisodeController`'s `season` param and the matching server-side filter loop are correctly implemented but **never exercised** from the frontend | Backend season-filter param and the equivalent of `SeasonOutOfBoundsException` are both dead code from the frontend's perspective; works today by accident (client-side filtering happens to be correct) but always over-fetches and never surfaces the specific "season doesn't exist" message. | MINOR |
| EP-04 | b | `EpisodeListPanel.EpisodeListTab` popup menu — right-click "Send to → Rename/List" (`PanelBuilder.episodeHandlerSequence()`), "Copy", "Save…" | **No `onContextMenu` handler exists anywhere** in `EpisodesExplorerPanel.tsx` — confirmed via full-file read | n/a | The entire cross-panel "push browsed episodes into the Rename matching engine" workflow — arguably the primary real-world reason to use this panel — has zero implementation. Episodes Explorer and Rename Workspace are fully isolated from each other. | BROKEN_FUNCTIONALITY |
| EP-05 | c | `EpisodeListPanel.getHistory()` seeds autocomplete from **`MediaDetection.releaseInfo`'s bundled index of every known series name** | React's "History" tab is a session-local list of only the current user's own past queries (capped at 10, lost on reload) | n/a — no series-name-index endpoint exists | Different, much smaller feature under the same label — legacy helps find the right query for an obscure title before typing much; React only re-runs a query already run this session. | MINOR |
| EP-06 | b | `Shift+Up`/`Shift+Down` keyboard shortcuts spin the season selector without a mouse | No keyboard handling for season navigation anywhere | — | Minor power-user convenience, fully absent. | MINOR |
| EP-07 | c | Season spinner is **locked to "All Seasons"** when the selected provider lacks per-season support (`!provider.hasSeasonSupport()`) | Season `<select>` always enabled regardless of provider | `EpisodeListProvider.hasSeasonSupport()` never queried anywhere in the service | Lower-impact than it sounds since EP-03 already makes season filtering purely client-side post-fetch, but no capability-gating guard exists. | COSMETIC |
| EP-09 | c | Unconfirmed whether legacy `net.filebot.web.SearchResult` carries a year field at all (file outside this pass's scope — flag, don't guess) | Disambiguation banner has a year-hint slot ready (`{res.year ? ... }`) | `EpisodeFetcherServiceImpl.searchSeries()` line 45-50 **hardcodes `year: null`** | Disambiguating same-named shows from different eras (spec's own "The Office US vs UK" example) can never show a year hint — every candidate renders identically. | MINOR |
| EP-10 | — | No format-preview feature exists anywhere in the 314-line legacy source | React also has none — **consistent with legacy, not a gap** | n/a | Spec-doc inaccuracy, not an implementation gap: spec 04 §A/§C invent a "Format Expression Preview bar"/`FormatPreviewFooter` with no legacy precedent — matches the established pattern of spec-authoring inventions found elsewhere (see §10). | N/A (spec correction) |
| EP-11 | — | `EpisodeListExportHandler`-backed "Save…" | `EpisodesExplorerPanel.tsx`'s `handleSaveAs()` — **genuinely working**, real client-side `.txt` export + clipboard copy of the season-filtered list | n/a | Positive control: one of very few "export" buttons in the entire codebase that actually works end-to-end, though its line format is hardcoded rather than driven by the user's real format expression (ties to EP-10). Not scored as a gap. | — |

*(Ambiguous items for this area: the AniDB client-version `6` vs `7` mismatch, whether `SearchResult` really carries a year field, and whether `Episode.toString()` matches React's hardcoded export line format — all flagged in `04_episodes_audit.md` §3 rather than guessed at.)*

### 7. History & Transaction Rollback
*(specs/08 — full detail: `specs/audit/08_history_and_list_audit.md`)*

| ID | Cat | Legacy source | React/Spring source | Description | Severity |
|----|-----|---------------|----------------------|-------------|----------|
| 1 | a | History has **no top-level panel** in legacy at all — only reachable via `RenamePanel`'s "Open History" button → modal `HistoryDialog` | `HistoryPanel.tsx` reachable only via the sidebar tab mislabeled "List" (`Wand2` icon) | See X3. No tab/menu/button anywhere says "History." | BROKEN_FUNCTIONALITY |
| 2 | c | `StandardRenameAction.revert(current, original)` (lines 193-237) — dispatches reversal by **live filesystem inspection** (symlink/regular-file/directory checks), since `History.Element` carries no action-type field at all | `HistoryServiceImpl.rollbackTransaction()` (lines 71-94) | **Performs no file operation whatsoever.** Only checks `File.exists()`; reports fake success/failure. Never calls `StandardRenameAction.revert()`. Clicking Undo on a row whose target still exists **falsely reports success** — actively misinforms the user, worse than a no-op. | DATA_INTEGRITY_RISK |
| 3 | d | `HistorySpooler.append(...)`, called from `CmdlineOperations.writeHistory()` after every successful CLI rename, gated on `action.canRevert()` | `RenameWorkspaceServiceImpl.java` — grep for History/rollback/revert returns **zero matches** | **Most severe cross-cutting finding in the whole audit.** Renames executed through the new app are never recorded to history at all. `HistorySpooler` is only ever read, never appended to, anywhere in the backend. Confirms RF-03 from the Rename side. `HistoryPanel.tsx` can therefore only ever show pre-existing legacy/CLI history — it is a read-only viewer of *other tools'* history, not of the app it lives in. | BROKEN_FUNCTIONALITY |
| 4 | c | Legacy `HistoryDialog` has **no "Clear History" feature at all** (full element inventory confirms no such button/action exists) | `HistoryServiceImpl.clearHistory()` (lines 96-99) body is literally the comment `// Session history clear` — does nothing | React clears its own state locally (false impression of success); a refresh immediately re-shows the untouched full log. Also: the spec itself invents this `DELETE /api/v1/history` endpoint with no legacy precedent — see §10. | DATA_INTEGRITY_RISK |
| 5 | c | `History.exportHistory()` — real JAXB marshal to `<history><sequence date="..."><rename dir="..." from="..." to="..."/></sequence></history>` (no `count` attribute, tag is `<rename>` not `<element>` — **spec's documented schema at line 24 is wrong**, see §10) | `HistoryServiceImpl.exportHistory()` correctly calls the real JAXB writer (good reuse) **but writes to the server's own working directory**, never surfaced to the Electron user; React's `handleExportHistory` **discards that response and hand-builds its own, non-compatible XML** client-side instead (wrong tag names, missing `dir` attribute, invented `action` attribute) | Two independent, mutually inconsistent export paths; the one the user actually receives cannot be re-imported by the legacy app. `format` param (CSV/HTML) accepted end-to-end but never implemented anywhere. | BROKEN_FUNCTIONALITY |
| 6 | b | `HistoryDialog` live multi-word AND filter across sequence+element tables (`filterEditor`, `HistoryFilter.include`) | No search/filter input exists anywhere in `HistoryPanel.tsx` (`filterQuery` from spec §C's state shape isn't implemented) | Full feature regression. | BROKEN_FUNCTIONALITY |
| 7 | b | `HistoryDialog.RevertAction` — confirmation dialog before any revert, **plus** a separate missing-file check that forces a "select different directory" recovery flow | `HistoryPanel.tsx`'s `handleRollbackRow` executes immediately with **no confirmation of any kind** | Legacy always confirms before any destructive op; React doesn't, and has no directory-remap recovery flow. | BROKEN_FUNCTIONALITY |
| 8 | b | Spec §D's "Directory Deletion Warning Modal" describes behavior **not actually present** in `StandardRenameAction.revert()` (no empty-parent-dir pruning found anywhere in that method) | No such modal exists in React either | Spec inaccuracy (see §10) compounded by the modal's total absence regardless. | COSMETIC (contingent on Gap 3) |
| 9 | c | n/a — legacy has no transaction/UUID concept, identifies sequences by table position | `HistoryServiceImpl.getTransactionHistory()` mints a **fresh random UUID on every call** for every transaction, with no stable ID persisted anywhere | `GET /api/v1/history/{id}` is effectively always broken — no ID from one call will ever match a later call. | MINOR |
| 10 | c | `History.Element` genuinely has no action-type field (not a regression) | `HistoryServiceImpl` hardcodes `FileAction.MOVE` for every row | Once Gap 3 is fixed and real COPY/HARDLINK/SYMLINK transactions start flowing, every row will still visibly (and incorrectly) say "MOVE." | MINOR |

*(Reuse note: `HistorySpooler.append()`, `HistorySpooler.getCompleteHistory()` (already correctly used for reads), `StandardRenameAction.revert()`, and `History.getRenameMap()` are all directly portable — see §9.)*

### 8. Settings & Preferences
*(specs/09 — full detail: `specs/audit/09_settings_audit.md`. IDs re-prefixed `SET-` here to avoid collision with Subtitles' `G`/SFV's `GAP-` schemes — original file uses bare `S-#`.)*

| ID (orig) | Cat | Legacy source | React/Spring source | Description | Severity |
|----|-----|---------------|----------------------|-------------|----------|
| SET-1 (S-1) | c | `RenamePanel.java:111-131` persists `rename.format.episode/movie/music/file` under Preferences node `net/filebot/ui/rename` | `SettingsServiceImpl.java:14,20-23` reads/writes `format.tv/movie/music/anime` under node `net/filebot` | Wrong node **and** wrong keys — a real user's existing legacy prefs never surface in the new Settings screen. | DATA_INTEGRITY_RISK |
| SET-2 (S-2) | c | Legacy installs its own portable `FilePreferencesFactory`/`PropertyFileBackingStore` (flat `prefs.properties` file, OS-registry-independent) | `SettingsServiceImpl.java:14` uses raw `java.util.prefs.Preferences` with no factory override — falls back to Windows Registry/plist | Real persistence-portability regression. Direct reuse target: `net.filebot.util.prefs.*` (3 small, zero-dependency classes). | DATA_INTEGRITY_RISK |
| SET-3 (S-3) | c | `rename.language` | `SettingsServiceImpl` uses `language.default` | Same node/key mismatch pattern as SET-1. | MINOR |
| SET-4 (S-4) | — | `rename.episode.order` | Not in Settings' scope (belongs to Rename/Episodes) | Correctly out of scope. | — |
| SET-5 (S-5) | flag | `Settings.java:59-61` — provider API keys are maintainer-baked into `application.properties`, **not user-editable** in legacy Swing at all | Settings' entire "Provider API Credentials" UI/endpoint | This whole feature is net-new, unverified against any legacy user-facing behavior — flag for product confirmation, not a "gap" per se. | flag |
| SET-6 (S-6) | c | n/a | `SettingsPanel.tsx:275` hardcodes `value="TVMAZE"` but the `ProviderType` union requires `'TV_MAZE'` | Type mismatch / likely live runtime bug. Also only 5 of 8 `ProviderType` values offered (missing OMDB, ACOUSTID, SHOOTER). | BROKEN_FUNCTIONALITY |
| SET-7 (S-7) | c | Spec 09 §B explicitly claims "(encrypted in persistence layer)" | `SettingsServiceImpl.java:88-96` stores API keys/passwords in **plaintext** | Directly contradicts the spec's own security claim. | DATA_INTEGRITY_RISK |
| SET-8 (S-8) | c/flag | Spec's "Clear Application Cache Confirmation Modal" conflates two unrelated legacy behaviors: an undiscoverable prefs-reset (no UI caller found for `Settings.clear()`) and `MainFrame`'s separate, confirmation-less `Ctrl+Shift+Delete`→`CacheManager.clearAll()` | React's "Reset to Defaults" button does neither faithfully; **no cache-clear endpoint exists anywhere in the port** | The one legacy behavior that demonstrably exists (the keyboard shortcut) is entirely missing from the port; see also AS-7. Spec itself may be conflating two things — see §10. | BROKEN_FUNCTIONALITY |
| SET-9 (S-9) | flag | `License.java` (211 lines) + `LicenseModel.java` (66 lines) — full PGP-signed license activation subsystem | Zero port coverage | Needs an explicit product scope decision, not an assumption either way. | flag |
| SET-10 (S-10) | b | `SupportDialog.AppStoreReview` | No equivalent | Same item as AS-11; low priority, recommend explicit won't-port marking. | COSMETIC |
| SET-11 (S-11) | flag | Spec claims `ui.theme`/`ui.language` legacy preferences exist | Not located anywhere in the audited files | Possible spec inaccuracy — see §10. | flag |
| SET-12 (S-12) | c | Legacy's 4th format slot is generic "File" mode, not "Anime" | Port invents an Anime-specific 4th format slot with no confirmed legacy source | Needs cross-check against Rename's `Mode` enum. | MINOR |
| SET-13 (S-13) | c | n/a | `AppShell.tsx:31` hardcodes a single global `formatExpression`; **never calls `settingsApi.getSettings()`** | None of Settings' four saved format presets ever reach the Rename workspace — the Format Presets tab is functionally inert. Confirms RF's AppShell-hardcoded-format finding from the other direction. | BROKEN_FUNCTIONALITY |
| SET-14 (S-14) | — | n/a | n/a | Positive control: core Settings CRUD (get/update/reset) is genuinely wired end-to-end with no dangling buttons, aside from the issues above. | — |

---

## 4. Ambiguous / Undocumented Legacy Behavior (flagged, not guessed at)

Per every area's audit file §3; consolidated here for visibility. **None of these
should be implemented or assumed away without an explicit product/engineering
decision** — each represents a place where the legacy source's intent could not be
determined with confidence from static reading alone.

1. **`ConflictStrategy.AUTO_RENAME`** (Rename area, AMB-1): no legacy precedent found
   anywhere in `ConflictDialog`/`RenameAction`/`ValidateDialog`/`StandardRenameAction`
   for an "append a numeric counter" conflict-resolution behavior. The only two
   real legacy resolutions are skip (`Continue`) and trash-then-overwrite
   (`Override`) — no distinct `FAIL`-the-batch behavior exists separate from
   cancelling the whole dialog either. `AUTO_RENAME` appears to be invented by the
   spec. **Do not build an "(1), (2), ..." counter scheme as if it were legacy
   behavior without product sign-off.**
2. **Per-type vs. global format expression persistence** (Rename area, AMB-2):
   legacy persists 4 independent format expressions and auto-selects the right one
   by the *runtime type* of each match's bound object. The current design threads
   one single global expression through the whole app. `AppSettingsDto` already has
   `tvFormat`/`movieFormat`/`musicFormat`/`animeFormat` fields suggesting per-type
   was the intended target, but nothing in the Rename workspace reads them (ties to
   SET-13). Needs an explicit decision on target design, since it changes multiple
   DTOs' shapes.
3. **Native-shell rename path** (Rename area, AMB-3): `RenameAction` branches to a
   platform-native rename path (`NativeRenameAction`) when available. Unclear
   whether the headless Spring Boot backend is expected to ever replicate this or
   whether `StandardRenameAction`-only is the accepted target.
4. **Clipboard Ctrl+V import** (App Shell, AS-5/AMB-AS1): `DefaultClipboardHandler`
   only implements copy-out; no explicit paste-import handler was found anywhere in
   the codebase. Any Ctrl+V-to-import behavior, if it exists at all in the running
   legacy app, would be an emergent side effect of Swing's default `TransferHandler`
   paste-action binding, not a dedicated feature — **verify by testing the actual
   legacy app before deciding whether this is a real gap worth building.**
5. **GroovyPad / F5** (App Shell, AMB-AS2): an interactive Groovy REPL with full JVM
   access. Porting as-is to a networked Spring Boot backend is a meaningfully
   different (larger) security exposure than a local desktop process. Recommend an
   explicit "drop" vs. "sandbox and port" product decision rather than either
   silently building or silently omitting it.
6. **History rollback's actual reversal rule** (History area, item 1): the spec's
   documented "MOVE deletes empty parent directories of `to`" claim does not
   correspond to any code found in `StandardRenameAction.revert()`, which dispatches
   purely from live filesystem state (no action-type is even persisted). See §10 —
   this is really a spec-accuracy issue, but the underlying question of "should
   empty-parent-dir pruning exist" is a genuine product question independent of
   whether the spec was right about where to find it.
7. **History `canRevert()` gating** (History area, item 4): `CmdlineOperations
   .writeHistory()` only appends to history `if (action.canRevert())`, and
   `StandardRenameAction.TEST` explicitly overrides this to `false`. Which of
   MOVE/COPY/KEEPLINK/SYMLINK/HARDLINK/CLONE/DUPLICATE return `true` vs. `false`
   beyond the interface default was not fully traced within this audit's scope —
   whoever fixes History Gap 3 should trace this fully before wiring up history
   writes, to avoid silently recording actions that shouldn't be revertible.
8. **Settings: license/registration subsystem scope** (Settings area, SET-9): a
   full 277-line PGP-signed license system exists in legacy with zero port coverage.
   Needs an explicit decision on whether license/registration is in scope for this
   port at all before treating it as a "gap" to close.
9. **Settings: provider-API-key editability** (Settings area, SET-5): legacy bakes
   provider API keys into a build-time properties file, not a user-facing settings
   screen. The port's entire "Provider Credentials" tab may be solving a problem
   that doesn't exist in the legacy UX model (or may be a deliberate, reasonable
   product improvement) — needs confirmation either way before treating SET-6/SET-7
   as pure "bugs" vs. "specify the design for a new feature."

---

## 5. Reuse Opportunities Catalog

*(Full detail and exact method signatures in each area's audit file §4. Consolidated
list of the highest-value, lowest-risk legacy Java classes/methods the Spring Boot
service layer should call directly instead of reimplementing — this is the
single biggest lever available to close the majority of BROKEN_FUNCTIONALITY/
DATA_INTEGRITY_RISK gaps quickly, since almost none of this logic is
Swing-coupled.)*

| Target gap(s) | Legacy class/method to port/call directly |
|---|---|
| RF-01, RF-02 (real matching engine) | `net.filebot.similarity.Matcher` + `EpisodeMetrics().matchFileSequence()`; `net.filebot.ui.rename.{EpisodeListMatcher,MovieMatcher,MusicMatcher,AutoDetectMatcher}`; `net.filebot.WebServices.{getEpisodeListProviders,getMovieIdentificationServices,getMusicIdentificationServices}` — plain Java, not Swing-coupled beyond an optional progress `Window` param that can be stubbed. **Highest-value, lowest-risk target in the entire audit.** |
| RF-03, History Gap 3 (write history on rename) | `net.filebot.HistorySpooler.getInstance().append(renameMap.entrySet())`, called immediately after each successful rename in `RenameWorkspaceServiceImpl.executeRename()`, mirroring `CmdlineOperations.writeHistory()` exactly (including the `action.canRevert()` gate — see Ambiguous item 7). |
| RF-04 (conflict/validation) | `ConflictDialog.check()`/`ValidateDialog.validate()`'s *validation logic* (duplicate-destination detection, illegal-character detection) is decoupled enough from Swing rendering to extract into a plain service method. |
| RF-15 (real binding catalog) | Reflective introspection of `net.filebot.format.MediaBindingBean`'s public getters, replacing the hardcoded 8-item list; the legacy `FormatDialog`/`BindingDialog` resource bundles likely already enumerate the canonical catalog and example expressions per mode — locate and reuse rather than hand-author a new list. |
| History Gap 2, Gap 7 (real rollback) | `net.filebot.StandardRenameAction.revert(File current, File original)` — already handles MOVE/COPY/HARDLINK/SYMLINK/KEEPLINK reversal purely from filesystem state; `History.getRenameMap()`/`HistoryDialog.RevertAction.getRenameMap()` for path resolution. |
| History Gap 5 (real export) | `net.filebot.History.exportHistory()`/`.importHistory()` — already correctly called by `HistoryServiceImpl` for the byte generation; the fix is to stream those bytes to the Electron client instead of writing server-side and having React re-fabricate its own (incompatible) XML. |
| SFV GAP-01/05/06 (real hashing) | `net.filebot.hash.{HashType.newHash(),ChecksumHash,MessageDigestHash}`; `net.filebot.util.FileUtilities.BUFFER_SIZE` (64KB, confirmed) for chunked reads; `ChecksumComputationService`'s `ThreadPoolExecutor` pattern for the concurrency model. |
| SFV GAP-07 | `net.filebot.hash.VerificationUtilities.getHashType(File)` for correct per-extension format dispatch, replacing the hardcoded `SfvFormat()`. |
| SFV GAP-08 | `net.filebot.hash.VerificationFileWriter`/`VerificationFormat.format()`/`SfvFormat.format()` for byte-correct export per hash type. |
| Subtitles G1-G5 (real search/download) | `net.filebot.subtitle.SubtitleUtilities.{lookupSubtitlesByHash,findSubtitlesByName,getBestMatch,matchSubtitles}` (the real Exact/Fuzzy strategy implementations); `net.filebot.web.{OpenSubtitlesClient,ShooterSubtitles,VideoHashSubtitleService}`; `net.filebot.subtitle.SubtitleNaming.format(...)` for correct output filenames. |
| Analyze AN-1 | `net.filebot.archive.{Archive,FileMapper}` — `Archive.open()`, `.listFiles()`, `.extract(...)`, zero Swing dependency except progress callbacks. |
| Analyze AN-2 | `SplitTool.createModelInBackground`'s bin-packing loop — plain `File`/`long` arithmetic, portable verbatim. |
| Analyze AN-3 | `net.filebot.media.XattrMetaInfo`/`MetaAttributes`/`net.filebot.MetaAttributeView` — already resolves the correct platform-specific xattr backend. |
| Analyze AN-4 | `net.filebot.media.MediaDetection.{isMovie,isEpisode,getDiskFolderFilter,getClutterFileFilter,getClutterTypeFilter}` + `net.filebot.MediaTypes`. |
| Analyze AN-8 | `MediaInfoInspectorServiceImpl` — read `HDR_Format`/`HDR_Format_Compatibility` MediaInfo keys instead of `colour_primaries`. |
| Analyze AN-9 | Catch `MediaInfoException` specifically before the generic `catch(Exception e)`. |
| EP-01 | `net.filebot.WebServices.{TheTVDB,TheMovieDB,AniDB}` pre-wired singletons + `new TVMazeClient()` — delete the placeholder `"test-key"` constructions entirely, matching `EpisodeListPanel.java:103-105`'s exact call chain. Lowest-effort, highest-value fix in the whole audit. |
| EP-02 | `Language.getLocale()`/`LanguageComboBox`'s selection-to-`Locale` resolution (`EpisodeListPanel.java:123`) — small mapping from `LanguageCode` to `java.util.Locale`. |
| EP-03 | `net.filebot.web.SeasonOutOfBoundsException` — plain, Swing-free exception class, catch/translate to a structured HTTP error. |
| EP-04 | Mirror the already-working Analyze-panel "Send to" client-side pattern (`AN-11`, `AppShell.tsx`'s `onNavigateTab`/`droppedFiles` lifting) — no backend reuse needed, legacy itself is pure client-side pub/sub here too. |
| EP-05 | `net.filebot.media.MediaDetection.releaseInfo.{getAnidbIndex(),getTheTVDBIndex()}` (`EpisodeListPanel.java:90-99` shows the exact flattening logic) for a lightweight autocomplete-index endpoint, if full parity is desired. |
| Settings SET-2 | `net.filebot.util.prefs.{FilePreferencesFactory,PropertyFileBackingStore,FilePreferences}` — verbatim, for durable cross-platform-consistent persistence. |
| Settings SET-1/SET-3 | `Settings.forPackage(Class).entry(String)` pattern per logical group, to guarantee node-path parity with legacy panels. |
| App Shell AS-8/X2 | `net.filebot.util.FileUtilities` recursive-expansion helpers; the exact hidden/system-file filter predicate used by `ui/transfer/FileTransferablePolicy.java`/`BackgroundFileTransferablePolicy.java`. |
| App Shell X1/AS-1/AS-2 | Infrastructural, not a Java port: inject `SimpMessagingTemplate` into `TaskProgressPublisher`, call it from inside the actual per-file loops once RF-01/GAP-01 etc. are real; mirror `NotificationHandler`'s `java.util.logging.Handler` pattern as a Spring `@Component` forwarding to `/topic/notifications`. |

---

## 6. Severity Rollup

Approximate counts across all 8 areas' gap tables (excludes informational/`—`-rated
and `flag`-only rows):

| Severity | Approx. count | Areas most affected |
|---|---|---|
| BROKEN_FUNCTIONALITY | ~44 | Rename/Format, Subtitles, SFV, Analyze, History, App Shell, Episodes (EP-01/EP-02/EP-04) |
| DATA_INTEGRITY_RISK | ~16 | SFV, Subtitles, History, App Shell, Settings, Analyze |
| MINOR | ~23 | spread across all areas, incl. Episodes EP-03/EP-05/EP-06/EP-09 |
| COSMETIC | ~9 | spread across all areas, incl. Episodes EP-07 |

**Episodes is the one bright spot:** its 3 BROKEN_FUNCTIONALITY items (EP-01/02/04)
are all narrow, well-scoped, low-risk fixes (a key-wiring swap, a hardcoded-locale
swap, and a client-side cross-panel wiring addition already proven elsewhere in the
codebase) rather than "write the feature from scratch," unlike the equivalent findings
in Rename, Subtitles, and SFV.

---

## 7. What This Means For The Engineering Team

Reading this report as a flat list of ~85 bugs would understate the actual state of
the port. The correct framing: **large parts of the Spring Boot service layer for
Rename matching, SFV hashing, and Subtitle search/download were never actually
implemented — they were scaffolded with the correct method signatures and DTO shapes,
then filled with plausible fake data or no-ops so the frontend would compile and
render something.** Before any UI-polish or dangling-button work is scheduled, the
team needs to treat this as: *the core backend logic for at least three major
workspaces needs to be written for the first time*, using the extensive, low-risk
reuse catalog in §5 as the starting point rather than a design-from-scratch effort.
`specs/IMPLEMENTATION_PLAN.md` sequences this work accordingly.

---

## 10. Spec Accuracy Corrections (not implementation gaps)

These are places where `specs/00`–`specs/09` (authored by a prior AI pass, before this
audit) describe legacy behavior that the actual Swing source does not support. Listed
separately because the correct fix is to **correct the spec**, not to build the
described behavior into the port as if it were a missing feature:

1. **Spec 02 (`ConflictStrategy.AUTO_RENAME`):** no legacy precedent found anywhere;
   see Ambiguous item 1.
2. **Spec 07 (Analyze real-time filter/search bar):** no such control exists anywhere
   in `FilterPanel`/`FileTreePanel`/`FileTree`/any `Tool` subclass — confirmed by full
   read (AN-13).
3. **Spec 09 (encrypted credential storage claim):** the spec asserts encryption; the
   implementation stores plaintext (SET-7) — but note the *spec's claim itself* should
   be treated as the requirement here, not evidence the implementation is "fine as
   documented." Flagged in both directions for clarity.
4. **Spec 09 (Clear Application Cache Confirmation Modal):** conflates two unrelated
   legacy behaviors (an undiscoverable prefs-reset, and `MainFrame`'s separate
   confirmation-less keyboard shortcut) into one feature that doesn't exist as
   described (SET-8).
5. **Spec 09 (`ui.theme`/`ui.language` preferences):** claimed to exist; not located
   anywhere in the audited legacy preference-handling files (SET-11) — possible
   invention, needs a targeted re-check before being trusted.
6. **Spec 08 (History XML schema, line 24):** documents
   `<history><sequence date="..." count="..."><element from="..." to="..."/></sequence></history>`.
   The real JAXB schema (from `History.java`'s annotations) is
   `<history><sequence date="...">` **no `count` attribute** `<rename dir="..." from="..." to="..."/>`
   (tag is `<rename>`, not `<element>`; `dir` is required and undocumented by the
   spec). This is load-bearing for interop with existing `~/.filebot/history.xml`
   files and must be corrected before anyone builds an importer/exporter against the
   spec's literal text.
7. **Spec 08 (empty-parent-directory pruning on MOVE rollback):** claimed in Section
   A; no such logic found anywhere in `StandardRenameAction.revert()` or its call
   sites within the audited file set (History area, Ambiguous item 6).
8. **Spec 08 (Clear History feature):** spec Section A describes "Clear History:
   Purges persistent transaction logs" as an existing legacy UI action; a full
   inventory of `HistoryDialog`'s buttons/menus/actions found no such feature
   anywhere (History Gap 4 / Ambiguous item — likely extrapolated from
   `HistorySpooler.commit()`'s internal file-truncation mechanics, which are never
   exposed as a user command in legacy).
9. **Spec 01 (clipboard Ctrl+V import via `DefaultClipboardHandler`):** that class
   implements only copy-out (Ctrl+C); see Ambiguous item 4.
