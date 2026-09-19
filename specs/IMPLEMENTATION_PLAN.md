# Implementation Plan — Closing the Swing→React/Spring Boot Parity Gaps

Source: `specs/audit/MASTER_AUDIT_REPORT.md` and its eight companion per-area audit
files (`specs/audit/00_CROSSCUTTING_FINDINGS.md` through `09_settings_audit.md`).
Read the master report's Executive Summary before starting — the single most
important fact shaping this plan's sequencing is that **the Rename matching engine,
SFV hashing, and Subtitle search/download are not partially-implemented features with
bugs; they are unimplemented stubs behind a real-looking UI.** Fixing those three is
prioritized above everything else because most of the smaller wiring/UX gaps in other
areas are either downstream of them (History can't show real data until Rename writes
it) or independent of them (Episodes, App Shell, Analyze can be fixed in parallel).

Every task below cites the exact gap ID(s) it closes (cross-reference
`MASTER_AUDIT_REPORT.md` §3 for full descriptions and file:line citations) and the
specific legacy Java class/method to port or call directly, per the audit's reuse
catalog (§5), rather than reimplementing from scratch. **Do not reimplement any logic
listed as "reuse directly" below — it already exists, is already correct, and is
already decoupled enough from Swing to call from a service.**

---

## Phase 0 — Foundational / Cross-Cutting (do first, everything else benefits)

These unblock or de-risk almost every later phase and are cheap relative to their
leverage.

**0.1 — Wire the WebSocket progress-publishing pipeline for real.** *(Closes X1,
AS-1, AS-2, GAP-04.)*
- Inject `SimpMessagingTemplate` into `TaskProgressPublisher`; change
  `publishRenameProgress`/`publishSfvProgress` to call
  `template.convertAndSend(WebSocketConfig.TOPIC_RENAME_PROGRESS, dto)` /
  `.TOPIC_SFV_PROGRESS`.
- Add a real producer for `/topic/notifications` — mirror
  `net.filebot.ui.NotificationHandler`'s `java.util.logging.Handler` pattern as a
  small `@Component` that forwards INFO/WARNING/SEVERE-equivalent service-layer
  events to the topic.
- **This task has no effect on its own** — it only starts paying off once Phase 1's
  real hashing/matching loops exist to call it from per-file. Do this first anyway
  so Phase 1 doesn't have to also invent the plumbing mid-implementation.
- Add the missing `websocketClient.subscribe('/topic/notifications', ...)` call
  somewhere in `AppShell.tsx` so the (currently-built, currently-pointless) frontend
  subscription actually renders something once messages start flowing.

**0.2 — Fix file intake (recursion, hidden-file filtering, consumed response).**
*(Closes X2, AS-8, AN-10.)*
- `AppShellController.processFileIntake`: implement real recursive directory
  expansion and hidden/system-file filtering. **Reuse directly:** the filter
  predicate already used by `net.filebot.ui.transfer.FileTransferablePolicy`/
  `BackgroundFileTransferablePolicy` — locate and port verbatim, do not
  hand-write a new `.DS_Store`/`Thumbs.db`/`desktop.ini` exclusion list.
- `AppShell.tsx`'s `handleFilesDropped`: stop discarding the intake response —
  populate `droppedFiles` from `acceptedFiles`, not raw drag-event paths.
- Introduce the `AppShellService` interface specs/00/01 already document (currently
  entirely absent — controller inlines file I/O) for testability and so
  `handleClipboardContent` (see 0.3) has somewhere to live.
- Fix `AnalyzePanel.tsx`'s copy/paste `targetWorkspace:'LIST'` bug (AN-10) —
  should be `'ANALYZE'`.

**0.3 — Resolve the List/History tab identity crisis.** *(Closes X3, AS-3, AS-4,
History Gap 1, AN-12 — the single most confusing cross-cutting defect found.)*
- Rename the sidebar tab currently labeled "List" (which renders `HistoryPanel`) to
  "History", with an appropriate icon (not `Wand2`).
- Add a genuinely new "List" tab/entry point that will host the real legacy List
  panel once Phase 3 builds it (stub the route now, implement the panel in Phase 3.4
  — don't block this rename on that work).
- Fix `AnalyzePanel.tsx`'s "Send to → List" (AN-12) to target the new, correctly-
  labeled History or List destination once each is disambiguated — currently
  silently discards the selected files.
- **This is a pure routing/labeling fix, no new business logic — do it early, it's
  cheap and immediately reduces user confusion while Phase 1/3 work is in flight.**

---

## Phase 1 — Real Service-Layer Implementations (highest severity, highest value)

The core "does this app actually do the thing" fixes. Sequence within this phase by
which feature is most central to the app's purpose.

**1.1 — Real matching engine (Rename Workspace).** *(Closes RF-01, RF-02 — the
single highest-priority fix in the entire audit.)*
- Replace `RenameWorkspaceServiceImpl.autoMatch()`'s hardcoded-0.85-score stub with
  real provider queries and similarity scoring.
- **Reuse directly:** `net.filebot.similarity.Matcher` +
  `EpisodeMetrics().matchFileSequence()`; the per-mode matchers
  `net.filebot.ui.rename.{EpisodeListMatcher,MovieMatcher,MusicMatcher,
  AutoDetectMatcher}`; `net.filebot.WebServices.{getEpisodeListProviders(),
  getMovieIdentificationServices(),getMusicIdentificationServices()}`. All plain
  Java, no Swing coupling beyond an optional progress `Window` parameter that can be
  stubbed/removed for a headless service.
- Once real `targetMetadata` flows through matches, RF-02 (format expressions
  resolving real metadata) is fixed as a side effect — no separate work needed.
- **Depends on:** nothing from Phase 0; can start immediately, in parallel with 1.2.

**1.2 — Write rename executions to history + implement real rollback.** *(Closes
RF-03, RF-12, History Gap 2, Gap 3 — second-highest priority, since Undo/Rollback is
silently non-functional today in a way that actively misleads users.)*
- In `RenameWorkspaceServiceImpl.executeRename()`, after each successful file
  operation, call `net.filebot.HistorySpooler.getInstance()
  .append(renameMap.entrySet())`, mirroring `CmdlineOperations.writeHistory()`
  exactly — **including its `action.canRevert()` gate** (trace which
  `StandardRenameAction` values return `true`/`false` from `canRevert()` before
  wiring this; flagged as needing verification in the History audit's Ambiguous
  item 7 — do not assume all four action types are revertible).
- Replace `HistoryServiceImpl.rollbackTransaction()`'s `File.exists()`-only stub
  with real calls to `net.filebot.StandardRenameAction.revert(File current, File
  original)` per target path — it already handles MOVE/COPY/HARDLINK/SYMLINK/
  KEEPLINK reversal purely from filesystem state (no schema change needed, since
  legacy's `History.Element` never persisted an action-type field either).
- Implement `HistoryServiceImpl.clearHistory()` for real (currently a comment) —
  **first confirm with the product owner whether this is even meant to exist**,
  since no legacy UI action for it was found anywhere (History audit §3 item 2).
- Fix history export: stream the bytes `History.exportHistory()` already correctly
  produces directly to the Electron client (`ResponseEntity<byte[]>`/
  `StreamingResponseBody` with `Content-Disposition: attachment`) instead of
  writing server-side and having React re-fabricate incompatible XML client-side.
  Use the corrected schema from specs/08's addendum (`<rename dir=... from=... to=.../>`,
  not `<element>`).
- Fix the non-deterministic transaction-ID bug (History Gap 9): derive a stable ID
  (e.g. from the sequence's `date` field) instead of `UUID.randomUUID()` minted
  fresh on every call, so `GET /api/v1/history/{id}` actually works.
- Add the "Open History" toolbar entry point inside the Rename workspace (RF-12),
  and the missing pre-rollback confirmation dialog + missing-file directory-remap
  flow (History Gap 7).
- **Depends on:** 1.1 not strictly required, but do 1.1 first since it's higher
  severity and touches the same file (`RenameWorkspaceServiceImpl`) — sequencing
  them together avoids merge friction.

**1.3 — Real SFV/checksum hashing.** *(Closes GAP-01, GAP-02, GAP-05, GAP-06,
GAP-07, GAP-08, GAP-09 — currently produces fabricated pass/fail verdicts, which is a
genuine data-integrity hazard if anyone relies on this feature today.)*
- Replace `ChecksumServiceImpl.startVerificationTask()`'s
  `UUID.randomUUID().toString()` stub with real chunked file hashing.
  **Reuse directly:** `net.filebot.hash.{HashType.newHash(),ChecksumHash,
  MessageDigestHash}`; `net.filebot.util.FileUtilities.BUFFER_SIZE` (64KB,
  confirmed) for chunked reads; port `ChecksumComputationService`'s
  `ThreadPoolExecutor`-per-root concurrency model (or adapt to Spring's
  `@Async`/`ThreadPoolTaskExecutor` — the `hashingExecutor` bean specs/00 already
  documents but which is currently never declared).
- Fix `parseVerificationFile` to use `net.filebot.hash.VerificationUtilities
  .getHashType(File)` for correct per-extension format dispatch instead of the
  hardcoded `SfvFormat()` — this alone fixes "loading a .md5/.sha1/.sha256 file
  silently returns nothing."
- Fix `generateVerificationFileContent` to use `net.filebot.hash.
  {VerificationFileWriter,VerificationFormat,SfvFormat}` for byte-correct,
  hash-type-appropriate export instead of hand-built `"path hash"` lines.
- Implement real task cancellation (`cancelVerificationTask` is currently
  `// No-op`) once there's an actual running task/thread pool to cancel.
- Wire per-file progress into `TaskProgressPublisher.publishSfvProgress` (now real,
  per Phase 0.1) so `/topic/sfv/progress` carries genuine data; then build the
  missing `SpeedGauge`/`TotalProgressBar`/`ETAIndicator` markup in `SfvPanel.tsx`
  (GAP-03), which currently doesn't exist even as unwired scaffolding.
- **Depends on:** Phase 0.1 for the progress-UI half of this task; the hashing
  itself has no dependency and can start immediately.

**1.4 — Real subtitle search and download.** *(Closes G1, G2, G3, G4, G5, G6, G7,
G12 — currently fabricates search results and reports fake download success while
writing no file to disk.)*
- Replace `SubtitleServiceImpl.searchSubtitles()`'s fabricated-descriptor stub with
  real provider queries. **Reuse directly:**
  `net.filebot.subtitle.SubtitleUtilities.{lookupSubtitlesByHash,
  findSubtitlesByName,getBestMatch,matchSubtitles}` for the real Exact
  (hash-based)/Fuzzy (name-based) strategies — note these run in **parallel**
  against one account in legacy, not as a provider switch; re-map the React
  Exact/Fuzzy buttons to this distinction instead of `OPEN_SUBTITLES`/`SHOOTER`.
  `net.filebot.web.{OpenSubtitlesClient,ShooterSubtitles,VideoHashSubtitleService}`
  for actual provider access.
- **Before implementing real multi-candidate search, add a `videoFilePath` field
  to `SubtitleDescriptorDto`** (G12) — the current flat-array contract is
  structurally incapable of correctly attributing results to the right video once
  a provider returns a variable number of candidates per video. Doing this after
  real search lands means a breaking DTO change later; do it now.
- Replace `downloadSubtitles()`'s no-op with real fetch + write, using
  `net.filebot.subtitle.SubtitleNaming.format(...)` for the output filename
  (currently the "Subtitle Naming" dropdown's selected value is captured in React
  state but never even sent to the backend — wire that through too, G5).
- Implement `uploadSubtitle()` for real, and build the missing Upload Modal (G6)
  and OpenSubtitles login/VIP-quota modal (G7) — **confirm scope/priority with
  product first**, these are larger net-new UI builds, not one-line fixes like the
  rest of this phase.
- Fix the hardcoded 4-of-16 language list and missing "All Languages" option (G10).
- **Depends on:** nothing from earlier phases; can run fully in parallel with 1.1-1.3.

---

## Phase 2 — Episodes Explorer Fixes (cheap, high value, do alongside Phase 1)

Unlike Phase 1's areas, Episodes' backend genuinely calls real provider clients
already — these are narrow, low-risk fixes, not missing implementations. Because
of that, **schedule this phase in parallel with Phase 1 rather than after it** — it
doesn't compete for the same engineering attention (matching-algorithm/hashing
expertise) that Phase 1 needs.

**2.1 — Fix the placeholder API key.** *(Closes EP-01, highest ROI fix in the whole
audit — a one-line-per-provider change.)*
- Delete `EpisodeFetcherServiceImpl.getProvider()`'s manual
  `new TheTVDBClient("test-key")`/`new TMDbTVClient(new TMDbClient("test-key",
  true))`/`new AnidbClient("filebot", 6)` constructions. **Reuse directly:**
  `net.filebot.WebServices.{TheTVDB,TheMovieDB,AniDB}` pre-wired singletons, and
  `new TVMazeClient()` (needs no key) — exactly matching
  `EpisodeListPanel.java:103-105`'s `WebServices.getEpisodeListProviders()` call
  chain. Also resolve the AniDB client-version mismatch (port uses `6`, legacy
  uses `7` — verify whether this matters against `net.filebot.web.AnidbClient`
  before deciding).

**2.2 — Fix hardcoded locale.** *(Closes EP-02.)*
- Replace the hardcoded `Locale.ENGLISH` in both `searchSeries()` and
  `getEpisodes()` with a locale derived from `request.language()`, mirroring
  `EpisodeListPanel.java:123`'s `Language.getLocale()` resolution pattern.

**2.3 — Wire Episodes → Rename cross-panel data flow.** *(Closes EP-04 — the
primary real-world reason to use this panel at all.)*
- Add the right-click "Send to → Rename" context menu, mirroring the already-working
  Analyze-panel "Send to" pattern (`AppShell.tsx`'s `onNavigateTab`/`droppedFiles`
  lifting, confirmed working per AN-11) — no backend involvement needed, legacy
  itself is pure client-side pub/sub here too.

**2.4 — Minor items (lower priority, batch together).** *(Closes EP-03, EP-05,
EP-06, EP-07, EP-09.)*
- Thread the already-defined `season` parameter through the actual
  `episodeApi.getEpisodes()` call sites instead of over-fetching and filtering
  client-side; surface a distinguishable "season out of bounds" error using
  `net.filebot.web.SeasonOutOfBoundsException` as the model.
- Add provider season-support capability gating (`hasSeasonSupport()`).
- Confirm `net.filebot.web.SearchResult`'s actual fields (does it carry a year?)
  before deciding whether EP-09's disambiguation-year gap is fixable as-is.

---

## Phase 3 — Analyze Panel Real Tool Implementations

Three of five tool tabs need genuinely new backend capability, not wiring fixes —
schedule after Phase 1 has freed up backend-service bandwidth, since these are
independent, additive features rather than fixes to existing broken flows.

**3.1 — Archives tab.** *(Closes AN-1.)* Reuse `net.filebot.archive.{Archive,
FileMapper}` directly (`Archive.open()`, `.listFiles()`, `.extract(...)`) — zero
Swing dependency except `ExtractWorker`'s progress callbacks, which should route
through the now-real WebSocket pipeline (Phase 0.1).

**3.2 — Parts tab.** *(Closes AN-2.)* Port `SplitTool.createModelInBackground`'s
bin-packing loop verbatim — plain `File`/`long` arithmetic, no Swing dependency.

**3.3 — Attributes tab.** *(Closes AN-3.)* Reuse `net.filebot.media.
{XattrMetaInfo,MetaAttributes}`/`net.filebot.MetaAttributeView` directly — already
resolves the correct platform-specific xattr backend (Windows/Linux/macOS/BSD).
This also finally populates `MediaFileDto.xattrs`, currently hardcoded to an empty
map in `AppShellController`.

**3.4 — Types tab.** *(Closes AN-4.)* Port `TypeTool.getMetaTypes()` using
`net.filebot.media.MediaDetection.{isMovie,isEpisode,getDiskFolderFilter,
getClutterFileFilter,getClutterTypeFilter}` and `net.filebot.MediaTypes` — pure
classification logic, no Swing dependency.

**3.5 — Fix MediaInfo tab defects.** *(Closes AN-8, AN-9 — small, isolated fixes to
an otherwise-correct implementation.)* Read `HDR_Format`/`HDR_Format_Compatibility`
MediaInfo keys instead of `colour_primaries`; catch `MediaInfoException`
specifically, before the generic `catch(Exception e)`, to surface the missing-
native-library warning.

**3.6 — Build the real List/Sequence-Generator panel.** *(Closes AS-3 — the
biggest single missing-feature gap outside the Phase 1 fabricated-backend areas;
also fills the "List" tab stubbed in Phase 0.3.)*
- Port `net.filebot.ui.list.{ListPanel,ListItem,IndexedBindingBean}`'s logic (pure
  Java, Groovy-format-driven sequence generation with From/To range binding) into
  a new `ListController`/`ListService`, and build the corresponding React panel
  (Pattern editor reusing the Format Expression Engine's evaluate endpoint,
  From/To spinners, Sequence button, Load/Save, right-click Send-to).
- **Author a new `specs/11_LIST_PANEL_AND_SEQUENCE_GENERATOR.md`** before starting
  this work — no existing spec 00-10 covers this feature at all, and per the
  original audit task's requirement that specs be updated to include newly
  discovered requirements, this needs its own first-class spec rather than being
  squeezed into an addendum.
- Add Electron IPC support for AN-5/RF-13's "Reveal in folder" while touching this
  area, since `ListPanel`'s legacy "Send to" workflow and file-reveal are adjacent
  UX concerns — bundle if convenient, don't force it if it doesn't fit naturally.

---

## Phase 4 — Settings & Persistence Correctness

Independent of Phase 1-3; can run in parallel with any of them once someone is free.

**4.1 — Fix Preferences node/key mismatch and persistence portability.** *(Closes
SET-1, SET-2, SET-3.)* Reuse `net.filebot.util.prefs.{FilePreferencesFactory,
PropertyFileBackingStore,FilePreferences}` verbatim; match legacy's exact node/key
paths via the `Settings.forPackage(Class).entry(String)` pattern.

**4.2 — Fix live bugs.** *(Closes SET-6 — `'TVMAZE'` vs `'TV_MAZE'` type mismatch,
likely a real runtime bug — and the missing OMDB/ACOUSTID/SHOOTER provider
options.)*

**4.3 — Wire Settings' saved format presets into the Rename workspace.** *(Closes
SET-13, ties to specs/03's per-type-format ambiguity — resolve the "one global
expression" vs. "four independently-persisted per-type expressions" product
question first, since it determines whether this is a small fix or a design change.)*

**4.4 — Decide and implement credential storage security.** *(Closes SET-7 —
currently plaintext despite the spec's own encryption claim.)* No existing
`net.filebot` utility is reusable for this (PGP class is signature-only); needs new
design, e.g. Electron `safeStorage`.

**4.5 — Product decisions needed before further work** *(does not block 4.1-4.4)*:
license/registration subsystem scope (SET-9); whether the Provider Credentials UI
is even the right feature given legacy bakes keys into a build-time properties file
(SET-5); cache-clear endpoint + shortcut (SET-8, shared with AS-7).

---

## Phase 5 — Remaining UI Wiring & Dangling-Element Cleanup

Lower risk, lower severity than Phases 1-4 — schedule as capacity allows, ideally
alongside code review passes rather than as a dedicated sprint.

- **RF-05:** wire `MatchTableContainer.tsx` to a per-row exclude control (the
  backend already honors `Match.isExcluded` correctly) — either lift the working
  logic out of the orphaned `MatchTable.tsx` or delete that dead component and
  implement inline.
- **RF-16:** either wire `BindingPicker.tsx` into the UI somewhere or delete it —
  currently dead code duplicating `EpisodeBindingsModal.tsx`.
- **RF-06 (F2):** add a manual-override rename UI — currently no substitute exists
  at all for hand-correcting one mismatched filename.
- **RF-09:** add double-click-to-edit-format-for-this-row on match rows once RF-01
  makes real metadata available to preview.
- **RF-11:** build the Preset Manager Modal (specs/03 §D) — full CRUD, apply via
  UI or number keys — currently 100% absent on both frontend and backend. This is
  a substantial feature, not a small wiring fix; size it accordingly.
- **AN-5:** add an Electron IPC channel for "Reveal in Folder"/"Reveal" (currently
  dangling no-ops) — bundle with Phase 3.6 if convenient.
- **AN-6:** add "Move to Trash" context menu item.
- **AN-7:** wire the already-working `analyzeApi.batchInspect` into a multi-file
  MediaInfo comparison view (spec §A describes this; the endpoint just needs a
  caller).
- **G8/G9:** subtitle context menu (Preview/Save As/Export) and distinct
  upload/download drop targets.
- **GAP-10/GAP-12:** Missing Files Warning Modal for SFV; filename-embedded-
  checksum highlighting and the `WARNING` status concept.
- **History Gap 6, Gap 8:** search/filter input in `HistoryPanel.tsx`; the
  Directory Deletion Warning Modal (contingent on confirming whether that legacy
  behavior even exists — see specs/08 addendum's spec-correction note first).
- **AS-6:** drag-hover-to-preview-switch on sidebar tab icons.
- **AS-9/AS-10:** Getting-Started onboarding flow; Help menu links.

---

## Explicit Product Decisions Required Before Implementation (do not guess)

Collected from every area's "Ambiguous/undocumented behavior" section — resolve
these with the product owner; implementing a guess risks building the wrong thing
twice.

1. **`ConflictStrategy.AUTO_RENAME`** — no legacy precedent found anywhere. Build a
   numeric-counter scheme, or remove the enum value and align strictly with
   legacy's skip/trash-overwrite pair? *(Blocks RF-04.)*
2. **Per-type vs. global format expression persistence** — four independently-
   auto-selected legacy expressions vs. the current single global one.
   `AppSettingsDto` already has the four fields; nothing reads them yet. *(Blocks
   SET-13, shapes specs/02 & specs/03 work.)*
3. **GroovyPad (F5)** — port as a sandboxed feature, or explicitly drop given it
   becomes a materially larger RCE surface once the backend is networked? *(Blocks
   nothing else; low priority either way, but needs a decision, not silence.)*
4. **Clipboard Ctrl+V import** — verify against the actual running legacy app
   whether this behavior exists at all before building anything for it. *(Blocks
   AS-5 only if confirmed real.)*
5. **"Clear History" feature** — no legacy UI action found for it anywhere; is this
   a deliberate net-new feature (needs a real implementation) or should it be
   removed from scope? *(Blocks History Gap 4.)*
6. **License/registration subsystem** — in or out of scope for this port? *(Blocks
   SET-9 only; nothing else depends on this.)*
7. **Provider Credentials UI's premise** — legacy bakes API keys into a build-time
   file with no user-facing editor; confirm the port's user-editable-credentials
   design is an intentional improvement, not a misunderstanding of the legacy UX.
   *(Shapes the scope of Phase 4 broadly.)*
8. **History `canRevert()` gating per action type** — needs full tracing before
   Phase 1.2 wires history writes, to avoid recording actions that legacy
   deliberately excludes from revertibility (confirmed only for `TEST`; the other
   six action types' `canRevert()` values were not fully traced in the audit).

---

## Sequencing Summary (Gantt-style dependency view)

```
Phase 0 (foundational)         [====]
Phase 1.1 Rename matching             [========]
Phase 1.2 History write+rollback          [========]     (starts after 1.1 touches same file)
Phase 1.3 SFV real hashing            [========]         (parallel with 1.1)
Phase 1.4 Subtitle real search/dl     [========]         (parallel with 1.1/1.3)
Phase 2   Episodes fixes        [====]                   (parallel with Phase 1, cheap+independent)
Phase 3   Analyze real tools                  [======]   (after Phase 1 frees backend bandwidth)
Phase 4   Settings/persistence        [======]           (independent, any time)
Phase 5   UI wiring cleanup                       [====] (ongoing, lowest risk, fold into review)
```

Product decisions (above) should be resolved before or during Phase 1/2 kickoff,
since several of them (#1, #2, #8) directly shape those phases' implementation
details.
