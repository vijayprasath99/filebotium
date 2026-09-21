# Settings & Preferences Specification

**Status:** As-built. Describes `frontend/src/components/SettingsPanel.tsx` and
`net.filebot.backend.{controller.SettingsController, service.SettingsService,
service.SettingsServiceImpl}` exactly as implemented. Unlike Rename/SFV/Subtitles, this area's
CRUD plumbing was never a fabricated stub — `getAppSettings`/`updateAppSettings`/
`saveProviderCredentials`/`resetToDefaults` all genuinely read and write real persisted state
from day one. Every bug found in this area was a **"wrong node/key" or "wrong storage
mechanism"** class of bug (settings were being saved somewhere that legacy never reads from,
or in a format that isn't portable, or in plaintext) — not a "nothing happens" class of bug.
Frame any future work here accordingly: verify *where* a setting lives before assuming its
read/write path is broken.

---

## 1. UI (`SettingsPanel.tsx`)

A single-page settings form with three cards:

1. **General Defaults** — Default File Action (`MOVE`/`COPY`/`HARDLINK`/`SYMLINK`), Default
   Language (6 of 16 `LanguageCode` values are offered: EN/DE/FR/ES/JA/ZH — not exhaustive),
   and two checkboxes: "Filter hidden files and system artifacts" (`filterHiddenFiles`) and
   "Recursively inspect directories upon drag-and-drop" (`recursiveSearch`).
2. **Default Format Presets** — four plain-text inputs bound to `AppSettingsDto.tvFormat` /
   `.movieFormat` / `.animeFormat` / `.musicFormat`. The field labeled **"Anime Format"** in
   the UI is a naming mismatch worth understanding, not a bug to silently rename: legacy's
   real 4th format slot (`RenamePanel`'s `rename.format.file` preference) is a generic
   **"File"** mode, not anime-specific. `AppSettingsDto.animeFormat` was named for an
   assumption made early in this port and now ripples through `RenameWorkspace.tsx`'s
   `MatchingMode` union (`TV | MOVIE | MUSIC | ANIME | AUTO`) and this panel's label. Renaming
   it to match legacy's real semantics is a product decision (does the port want a dedicated
   Anime mode, which legacy doesn't have, or should it match legacy's generic 4th "File" slot
   exactly?) — not something to change unilaterally, since it's now load-bearing UI/API
   surface. See §5 "Known Gaps" for the concrete question to resolve before touching this.
3. **Provider API Credentials** — a provider `<select>` offering **all 8** `ProviderType`
   values (`THE_TVDB`, `THE_MOVIE_DB`, `OPEN_SUBTITLES`, `ANI_DB`, `TV_MAZE`, `OMDB`,
   `ACOUSTID`, `SHOOTER` — a prior version of this UI only offered 5 and had a
   `'TVMAZE'`/`'TV_MAZE'` string-literal mismatch that made selecting TVmaze a silent runtime
   type error; both are fixed), plus API Key/Token, Username, Password inputs and a "Save Key"
   button. See §4 for what actually happens to these values, and why they are currently
   write-only.

Buttons: **Save Settings** (`PUT /api/v1/settings`), **Reset to Defaults**
(`DELETE /api/v1/settings`, with a confirm dialog), and per-credential **Save Key**
(`POST /api/v1/settings/credentials`).

`frontend/src/api/client.ts`'s `settingsApi` wraps these four calls 1:1
(`getSettings`/`updateSettings`/`resetToDefaults`/`saveCredentials`); there is no client-side
caching or optimistic update beyond React state.

---

## 2. REST Contract

```
GET    /api/v1/settings              -> AppSettingsDto
PUT    /api/v1/settings   (body: AppSettingsDto)  -> AppSettingsDto
POST   /api/v1/settings/credentials  (body: ProviderCredentialDto)  -> 204
DELETE /api/v1/settings              -> 204   (clears BOTH preference nodes - see §3)
```

```java
public record AppSettingsDto(
    LanguageCode defaultLanguage, FileAction defaultAction,
    String tvFormat, String movieFormat, String musicFormat, String animeFormat,
    boolean filterHiddenFiles, boolean recursiveSearch) implements Serializable {}

public record ProviderCredentialDto(
    ProviderType provider, String apiKey, String username, String password)
    implements Serializable {}
```

`updateAppSettings` is a **partial update**: each field is only written if non-null in the
request body (`if (settings.tvFormat() != null) ...`), so a client may send a DTO with only
the fields it wants to change — but every call still returns the full, freshly-re-read
`AppSettingsDto` afterward (`getAppSettings()` is called again at the end of
`updateAppSettings()`), so the response is always authoritative.

---

## 3. Persistence: Two `Preferences` Nodes, One Portable Backing Store

`SettingsServiceImpl` holds two separate `java.util.prefs.Preferences` node references:

```java
// Same node legacy's own RenamePanel uses (net/filebot/ui/rename) - anything with a real
// legacy analogue lives here, under legacy's real key names, so an existing user's
// ~/.filebot preferences surface correctly in this new Settings screen.
private final Preferences renamePrefs = Preferences.userNodeForPackage(RenamePanel.class);

// Backend-only additions with no legacy user-facing equivalent live here instead.
private final Preferences prefs = Preferences.userNodeForPackage(Settings.class);
```

| Field | Node | Key | Legacy default |
|---|---|---|---|
| `defaultLanguage` | `renamePrefs` | `rename.language` | `"en"` (lowercase, matches legacy's `Settings.forPackage(RenamePanel.class).entry("rename.language").defaultValue("en")`) |
| `tvFormat` | `renamePrefs` | `rename.format.episode` | `{n} - {s00e00} - {t}` |
| `movieFormat` | `renamePrefs` | `rename.format.movie` | `{n} ({y})/{n} ({y})` |
| `musicFormat` | `renamePrefs` | `rename.format.music` | `{artist} - {album}/{pi} - {t}` |
| `animeFormat` | `renamePrefs` | `rename.format.file` | `{n} - {absolute} - {t}` (see §1 for the naming mismatch) |
| `defaultAction` | `prefs` | `action.default` | `MOVE` |
| `filterHiddenFiles` | `prefs` | `file.filter.hidden` | `true` |
| `recursiveSearch` | `prefs` | `file.search.recursive` | `true` |

`resetToDefaults()` calls `.clear()` on **both** nodes.

**Portable backing store.** Neither node is backed by the OS-native registry/plist/XML store.
`FileBotBackendApplication`'s static initializer (runs before `main()`'s body, and — critically
— before Spring or any service touches a `Preferences` object, since
`java.util.prefs.Preferences` caches its `PreferencesFactory` implementation on first use)
installs `net.filebot.util.prefs.FilePreferencesFactory`:

```java
static {
  if (System.getProperty("java.util.prefs.PreferencesFactory") == null) {
    System.setProperty("java.util.prefs.PreferencesFactory", FilePreferencesFactory.class.getName());
  }
  if (System.getProperty("net.filebot.util.prefs.file") == null) {
    System.setProperty("net.filebot.util.prefs.file",
        ApplicationFolder.AppData.resolve("prefs.properties").getPath());
  }
}
```

This redirects **all** `Preferences` I/O for the whole JVM (both nodes above) to a flat
`~/.filebot/prefs.properties` file. If you ever need to add a third `Preferences` node
anywhere in the backend, it will automatically use the same portable store — no extra wiring
required, as long as this static initializer still runs first. Do not move Preferences access
into a static field of a class that could plausibly be loaded before
`FileBotBackendApplication` — that would race the factory installation.

**Test caveat:** `src/test/java/net/filebot/backend/SettingsServiceTest.java` instantiates
`SettingsServiceImpl` directly (`new SettingsServiceImpl()`), bypassing
`FileBotBackendApplication`'s static initializer entirely — so unit tests exercise the
*default* JVM `Preferences` backend (OS registry on Windows, etc.), not the portable file
store. This is intentional (keeps tests independent of the Spring context) but means the
portable-store behavior itself is only exercised by actually running the packaged application,
not by the test suite.

---

## 4. Credential Encryption (and its limits)

`saveProviderCredentials()` never writes a plaintext value to `Preferences`:

```java
prefs.put("api.key." + key, CredentialCipher.encrypt(credentials.apiKey()));
```

`CredentialCipher` (a private nested class in `SettingsServiceImpl`) is a minimal AES-256-GCM
implementation:

- **Key:** 256-bit, generated once via `SecureRandom`, persisted at
  `~/.filebot/credentials.key`. On write, the code attempts to restrict the file to
  owner-only access (`setReadable(false,false)` / `setWritable(false,false)` then
  `setReadable(true,true)` / `setWritable(true,true)` — best-effort; POSIX permission bits
  aren't fully expressible through this API on all platforms). If the key file can't be
  written at all (e.g. read-only filesystem), the code falls back to a **process-local,
  never-persisted** random key — credentials are still never written in plaintext, but they
  become unreadable after a restart (silently; there's no user-facing warning for this case).
- **Ciphertext format:** `base64(12-byte random IV || AES-GCM ciphertext+tag)`, one IV
  generated fresh per `encrypt()` call.
- **Verified by test:** `SettingsServiceTest.testProviderCredentialsAreNotStoredInPlaintext()`
  saves a known secret and asserts the raw `Preferences` value neither equals nor contains it.

**This is a backend-only mitigation, not OS-keychain-backed.** An Electron `safeStorage`-based
design (delegating encryption to the OS keychain via the Electron main process) was considered
during implementation but rejected for this pass: the Spring Boot backend is a plain JVM
process with no way to call into Electron's main-process API, and routing every credential
write through an IPC round-trip to the desktop wrapper would be a much larger change. AES-GCM
with a locally-generated key is a real improvement over plaintext (defends against "someone
reads `prefs.properties` casually" and "the file is committed to a backup/dotfiles repo by
accident") but does **not** defend against an attacker with full read access to the same user
account's filesystem (they can read `credentials.key` too).

**Nothing currently reads these values back for real provider calls.** Search the codebase for
`api.key.` / `api.username.` / `api.password.` outside `SettingsServiceImpl` itself — there are
no other references. `net.filebot.WebServices` (which every other area's service layer uses
for actual provider access — see specs 02, 04, 05) constructs its clients from **build-time**
`getApiKey(...)` properties, entirely independent of anything a user types into this panel. So
today, "Provider API Credentials" is a fully-functional, encrypted, **write-only** store that
has no effect on the application's actual behavior. See §5 for the product question this
raises.

---

## 5. Known Gaps / Deliberately Deferred

1. **Provider Credentials UI's premise is unconfirmed.** Legacy bakes provider API keys into a
   build-time properties file with no user-facing editor at all — this panel's entire feature
   may be solving a problem legacy's UX model doesn't have (or may be a deliberate, reasonable
   improvement over it). Needs an explicit product decision:
   - If it's meant to be a real improvement, `net.filebot.WebServices`' provider client
     construction needs to be changed to read from this encrypted store (with a build-time
     fallback), for every provider that currently reads `getApiKey(...)`.
   - If it's out of scope, the panel should say so explicitly (e.g. disable the form, or
     relabel it) rather than accepting input that silently does nothing functionally.
2. **`animeFormat` naming mismatch (§1).** Resolve whether the port wants a genuine
   Anime-specific 4th mode (diverging from legacy) or should rename the field/UI label to
   match legacy's real generic "File" semantics. This is intertwined with
   `MatchingMode.ANIME` in spec 02 and the Rename workspace's mode selector — changing one
   without the other will desync the UI label from what actually gets persisted.
3. **Per-type vs. global format-expression application is still not fully wired.**
   `AppShell.tsx` now calls `settingsApi.getSettings()` on mount and seeds the Rename
   workspace's active format expression from the saved **TV** format only
   (`setFormatExpression(settings.tvFormat)`), and `FormatEditorModal`'s "Use Format" button
   now also calls `settingsApi.updateSettings({...settings, tvFormat: expression})` to persist
   changes back. Before this, `AppShell.tsx` never called `settingsApi.getSettings()` at all,
   so the Format Presets tab had **zero** effect on the Rename workspace — that specific bug is
   fixed. What's still missing: `movieFormat`/`musicFormat`/`animeFormat` are saved and
   readable via this panel but nothing in `RenameWorkspace.tsx` auto-selects among the four
   saved presets by its current `MatchingMode` (`TV`/`MOVIE`/`MUSIC`/`ANIME`) — the workspace
   always uses whichever single expression is currently active regardless of mode, exactly
   like before. Wiring true per-mode auto-selection is a larger, still-open design question
   (does the Rename workspace's format field become mode-dependent and read-only until
   explicitly overridden, or does it stay a single free-form field that Settings merely
   seeds?), not a small follow-up fix.
4. **No cache-clear feature.** No endpoint or keyboard shortcut exists for clearing any kind
   of application cache (there also isn't a well-defined "cache" concept in the current
   backend to clear — no HTTP response caching, no provider-result cache beyond in-process
   objects that die with the JVM).
5. **License/registration subsystem: zero port coverage, by omission.** Legacy's PGP-signed
   `License.java` (registration/activation) has no equivalent anywhere in this backend or
   frontend. Needs an explicit in-scope/out-of-scope decision before treating this as a gap to
   close — it may not be relevant to this fork's distribution model at all.
6. **`ui.theme` / `ui.language` legacy preferences are unconfirmed.** An earlier draft of this
   spec asserted these exist as legacy preferences; they were never located anywhere in the
   audited legacy source during implementation. Treat that claim as unverified — do not build
   theme/UI-language persistence on the assumption that it mirrors a real legacy feature
   without checking `net.filebot.ui.*` and `net.filebot.Settings` yourself first.
