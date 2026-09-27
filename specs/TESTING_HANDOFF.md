# Test Suite Build-Out — Handoff

Status as of this session. Picking this back up: read this file, then continue with the
"Next up" list at the bottom, one spec area at a time (same approach used for 02 and 09).

## Approach agreed with the user

- **Stack:** JUnit 5, Spring Boot Test (`@SpringBootTest(webEnvironment = RANDOM_PORT)`,
  `TestRestTemplate`), WireMock (in-JVM, not Testcontainers — Docker isn't available on this
  machine), Playwright for Java (real headless Chromium driving the compiled React UI).
- **Dual-layer per spec area:** backend REST integration tests (no UI) + at least one Playwright
  E2E test driving the real built frontend through the real backend.
- **One spec area at a time, fully green**, before moving to the next. Confirmed working end to
  end with plain `./gradlew test` (no task exclusions) between areas.
- **No Testcontainers** — Docker Desktop's daemon isn't running here. If that changes, it's
  still fine to keep the WireMock-only approach; nothing here blocks adding Testcontainers later
  for a genuinely containerized dependency.

## Key architectural change made to enable testing

`net.filebot.WebServices` exposes provider clients (TheTVDB, TMDb, TVMaze, AniDB, OMDb, …) as
`static final` singletons with hardcoded hostnames — no DI seam, so WireMock couldn't intercept
calls made through them. Per the user's explicit direction, this was addressed **for the backend
service layer only** (legacy Swing/CLI code still uses `WebServices` statics untouched):

- `src/main/java/net/filebot/backend/config/ProviderClientConfig.java` (new) — exposes
  `Map<ProviderType, EpisodeListProvider>` and `Map<ProviderType, MovieIdentificationService>` as
  Spring beans, defaulting to the existing `WebServices.X` singleton instances (zero behavior
  change in production).
- `RenameWorkspaceServiceImpl` — now takes those maps via constructor injection instead of
  switching on `WebServices.X` directly. Old no-arg/1-arg constructors kept so the pre-existing
  direct-instantiation tests (`RenameWorkspaceServiceTest`, `ControllersIntegrationTest`) still
  work unmodified.
- A test's `@TestConfiguration` can now supply a `@Primary` bean whose map swaps in a client
  subclass pointed at a WireMock server (see `RenameWorkspaceWireMockTest` /
  `RenameWorkspaceE2ETest` for the pattern — subclass the real client, override its protected
  `getResource`/`getEndpoint` method to point at `wireMock.baseUrl()`, and override
  `getIdentifier()` with a random suffix so its on-disk cache doesn't collide with real usage).
- **If another spec area's service also calls `WebServices` directly (episodes/subtitles/etc.),
  it needs the same treatment before it can get real WireMock coverage** — check
  `EpisodeFetcherServiceImpl.getProvider(...)` and `SubtitleServiceImpl` first; they still use
  `WebServices` statics directly as of this session.

## Build/tooling gotchas already solved (don't rediscover these)

- **WireMock + module path:** `org.wiremock:wiremock` ships relocated `com.github.jknack.handlebars`
  classes that JPMS treats as a split package against Playwright's/Spring's own deps. Fixed via
  `compileTestJava.moduleOptions.compileOnClasspath = true` and `test.moduleOptions.runOnClasspath
  = true` in `build.gradle` — tests now compile and run on the classpath, not the module path.
  Don't try to fix this with dependency excludes instead; that was tried first and broke WireMock
  at runtime (`NoClassDefFoundError` for a handlebars helper it actually needs).
- **`@TestConfiguration` bean name collisions:** a `@Bean` method in a test's `@TestConfiguration`
  must NOT share a method name with the production `@Bean` in `ProviderClientConfig`
  (`episodeProviders`/`movieProviders`) even with `@Primary` — Spring throws
  `BeanDefinitionOverrideException` on the name collision before `@Primary` ever gets a chance to
  resolve anything. Use a different method name (e.g. `wireMockEpisodeProviders`); `@Primary`
  still makes Spring prefer it by type for autowiring.
- **`{...}` in a URL query param via `TestRestTemplate`:** `RestTemplate` treats `{...}` as a URI
  template variable even in query strings, so a raw `format?formatExpression={fn}.x` throws
  "Not enough variable values available to expand 'fn'". Build the URI with
  `UriComponentsBuilder...queryParam(...).build().encode().toUri()` and use
  `restTemplate.exchange(uri, ...)` instead of the string-URL overloads whenever a format
  expression is in a query param.
- **Playwright browser install:** `com.microsoft.playwright:playwright` needs its browser binary
  installed separately (not bundled in the Maven jar). Added a `installPlaywrightBrowsers` Gradle
  task (`java -cp testRuntimeClasspath com.microsoft.playwright.CLI install chromium`); already
  run once on this machine (`C:\Users\vijay\AppData\Local\ms-playwright\`). Re-run it on a fresh
  machine/CI runner before the E2E tests will pass.
- **Rename workspace UI has no file-picker automation path.** Browsers only expose a bare
  filename from `<input type=file>`, never an absolute path — the app itself works around this
  with a "Base Folder Override" text field (see spec 02 §1). The E2E test drives that exact same
  workaround: `setInputFiles` on the hidden `<input type=file>`, then fill the Base Folder
  Override input with the real temp dir. Reuse this pattern for any other panel's E2E tests that
  need to load files (Subtitles, SFV, Analyze).
- **`FilePreferencesFactory`/`PropertyFileBackingStore` (spec 09) has a shared, JVM-global,
  `modCount`-gated flush** — don't assert on the *raw file bytes* of `~/.filebot/prefs.properties`
  right after a `flush()` call in a test that runs alongside other `@SpringBootTest` classes in
  the same Gradle test worker; it's racy (observed a real flake in the full-suite run this
  session). Instead assert through the `Preferences` API itself: `flush()` then `sync()` then
  `.get(key, null)` — that proved reliable across repeated full-suite runs. See
  `SettingsControllerRestApiTest.settingsAndCredentials_persistThroughThePortableFileStore()`.
- **`@SpringBootTest` writes to the REAL `~/.filebot/prefs.properties`** on whatever machine runs
  the tests (same file the packaged app itself uses) — there's no sandboxing. Every new REST test
  that touches settings/presets snapshots the prior state in `@BeforeEach` and restores it in
  `@AfterEach` (see `SettingsControllerRestApiTest`, `PresetControllerRestApiTest`). Keep doing
  this for any future test that touches `Preferences`.

## Real behaviors discovered while writing these tests (not bugs — document, don't "fix")

- `{fn}`/`{n}` format bindings evaluated against a bare `java.io.File` (no matched metadata)
  resolve to the **basename without extension**, not the full filename — verified empirically,
  not assumed.
- `POST /api/v1/settings/credentials` and `DELETE /api/v1/settings` are documented in spec 09 §2
  as returning `204`, but both controller methods are plain `void` Spring MVC handlers with no
  `@ResponseStatus`, so they actually return `200 OK`. Tests assert the real `200`, with a comment
  noting the spec says otherwise — flag this as a spec-vs-implementation discrepancy if anyone
  asks, don't silently "fix" either side without a product decision.
- `AppSettingsDto.filterHiddenFiles`/`.recursiveSearch` are primitive `boolean`s, so
  `updateAppSettings`'s partial-update null-guards (spec 09 §2) don't apply to them — **any** PUT,
  even one that only sets `tvFormat` in raw JSON, silently resets both booleans to `false`
  (Jackson defaults missing primitive fields to `false` on a record). Covered by
  `SettingsControllerRestApiTest.updateSettings_partialJsonBody_resetsBooleanFieldsToFalse()`.

## What's done and green (`./gradlew test`, full suite, no exclusions, run twice to confirm stable)

**Spec 02 — Rename Workspace & Matching Engine:**
- `RenameWorkspaceRestApiTest` — 7 tests, match/align/format/execute over real HTTP,
  deterministic via `MatchingMode.MUSIC`, `@TempDir` for real file moves/errors.
- `RenameWorkspaceWireMockTest` — 2 tests, real TVMaze search/show/episodes pipeline through
  WireMock (proves the real `EpisodeMatcher` + `ExpressionFormat` code path), plus the
  provider-HTTP-failure fallback path.
- `PresetControllerRestApiTest` — 3 tests, Preset Manager CRUD over real HTTP.
- `RenameWorkspaceE2ETest` — 1 Playwright test: load file → base-folder override → match
  (WireMock-backed TVMaze) → rename → verifies the file was actually renamed on disk.

**Spec 09 — Settings & Preferences:**
- `SettingsControllerRestApiTest` — 7 tests: GET defaults, full/partial PUT semantics (including
  the boolean-reset behavior above), credential encryption-at-rest via REST, reset-to-defaults
  clearing both `Preferences` nodes, and the portable-file-store round-trip.
- No E2E test written yet for the Settings panel UI itself (only backend REST coverage) — worth
  adding when spec 09 gets picked up again, or bundle it with a later UI pass.

## Next up (in spec-doc order — pick a different order if priorities differ)

1. `specs/01_APP_SHELL_NAVIGATION_AND_GLOBAL_DND.md` — App shell, global drag-and-drop, sidebar
   nav. Mostly frontend-state-driven; likely light backend coverage (`AppShellController`) plus
   an E2E test for the global dropzone.
2. `specs/03_GROOVY_FORMAT_EXPRESSION_ENGINE.md` — `FormatController`/
   `FormatExpressionEngineServiceImpl`. No network dependency; should be straightforward REST +
   E2E (Format Editor modal, live validate/eval on debounce).
3. `specs/04_EPISODES_EXPLORER_AND_FETCHER.md` — will need the same `WebServices`-injection
   treatment as spec 02 before WireMock coverage is possible (`EpisodeFetcherServiceImpl` still
   uses `WebServices` statics directly — check if it can reuse `ProviderClientConfig`'s beans or
   needs its own).
4. `specs/05_SUBTITLES_SEARCH_AND_DOWNLOADER.md` — same caveat; `SubtitleServiceImpl` also on
   `WebServices` statics (OpenSubtitles/Shooter clients).
5. `specs/06_SFV_VERIFICATION_AND_HASHING.md` — no network; real file hashing with `@TempDir`.
6. `specs/07_ANALYZE_PANEL_AND_MEDIAINFO_INSPECTOR.md` — no network; archive/mediainfo
   inspection, real fixture files needed.
7. `specs/08_HISTORY_AND_TRANSACTION_ROLLBACK.md` — depends on `HistorySpooler`
   (`~/.filebot/history.xml`, real file like Preferences) — apply the same
   snapshot/restore-in-`@AfterEach` discipline.
8. `specs/10_CROSS_PLATFORM_PACKAGING_GUIDE.md` — packaging/Electron; likely out of scope for
   JUnit/Playwright coverage, confirm with the user before attempting.

## Uncommitted changes right now

Nothing has been committed this session (per instructions — only commit when explicitly asked).
`git status` shows the above files staged/untracked on
`feat/swing-to-spring-react-specifications-1927926761128254998`. Review and commit when ready.
