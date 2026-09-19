# Settings & Preferences Specification

## Section A: Legacy Codebase Analysis

### Source Files Audited
- `src/main/java/net/filebot/util/prefs/FilePreferences.java`
- `src/main/java/net/filebot/util/prefs/FilePreferencesFactory.java`
- `src/main/java/net/filebot/util/prefs/PropertyFileBackingStore.java`
- `src/main/java/net/filebot/util/SystemProperty.java`
- `src/main/java/net/filebot/ui/SupportDialog.java`
- `src/main/java/net/filebot/Settings.java`

### UI Hierarchy & Preferences Structure
1. **Preferences / Configuration Backend (`FilePreferences`)**:
   - Implements Java `Preferences` SPI backed by a local property file (`PropertyFileBackingStore`).
   - Store Keys:
     - `database.thetvdb.language`, `database.themoviedb.language`.
     - `format.tv`, `format.movie`, `format.music`, `format.anime`.
     - `action.default` (`MOVE`, `COPY`, `HARDLINK`, `SYMLINK`).
     - `api.key.thetvdb`, `api.key.themoviedb`, `api.key.opensubtitles`, `api.key.omdb`.
     - `ui.theme`, `ui.language`.

---

## Section B: Target Spring Boot Backend Specification

### Service Interfaces & DTOs

```java
package net.filebot.backend.service;

import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ProviderCredentialDto;

public interface SettingsService {
    AppSettingsDto getAppSettings();
    AppSettingsDto updateAppSettings(AppSettingsDto settings);
    void saveProviderCredentials(ProviderCredentialDto credentials);
    void resetToDefaults();
}

public record AppSettingsDto(
    LanguageCode defaultLanguage,
    FileAction defaultAction,
    String tvFormat,
    String movieFormat,
    String musicFormat,
    String animeFormat,
    boolean filterHiddenFiles,
    boolean recursiveSearch
) {}

public record ProviderCredentialDto(
    ProviderType provider,
    String apiKey,
    String username,
    String password
) {}
```

### REST Endpoints

#### 1. Get Application Settings Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/settings`
- **Response JSON Schema:** Standard `AppSettingsDto` fields.

#### 2. Update Application Settings Endpoint
- **Method:** `PUT`
- **Path:** `/api/v1/settings`
- **Request JSON Schema:** Standard `AppSettingsDto` fields.

#### 3. Save Provider API Key Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/settings/credentials`
- **Request JSON Schema:** Standard `ProviderCredentialDto` fields (encrypted in persistence layer).

---

## Section C: Target React Frontend Specification

### Component Architecture

```
SettingsPanel
├── SettingsTabNav (General, Formats, Providers & API Keys, Advanced)
├── GeneralSettingsTab (Default Action, App Language, File Filtering)
├── FormatPresetsTab (Format editors for TV, Movie, Anime, Music)
├── ProviderCredentialsTab (API Keys for OpenSubtitles, TheTVDB, TMDb, OMDb)
└── AdvancedTab (Cache clearing, System info export)
```

### Props & State Types (TypeScript)

```typescript
import { FileAction, LanguageCode, ProviderType } from './types';

export interface AppSettings {
  defaultLanguage: LanguageCode;
  defaultAction: FileAction;
  tvFormat: string;
  movieFormat: string;
  musicFormat: string;
  animeFormat: string;
  filterHiddenFiles: boolean;
  recursiveSearch: boolean;
}

export interface ProviderCredential {
  provider: ProviderType;
  apiKey: string;
  username?: string;
  password?: string;
}
```

---

## Section D: Dialogs, Modals & Edge Cases

1. **Clear Application Cache Confirmation Modal:**
   - Warns user before purging local HTTP and metadata response caches.
2. **Invalid API Key Warning Toast:**
   - Triggered when provider API authentication fails during credential validation check.

---

## AUDIT ADDENDUM (2026-09-19) — DO NOT SILENTLY OVERWRITE ORIGINAL CONTENT ABOVE

Full detail: `specs/audit/09_settings_audit.md` (gaps re-prefixed `SET-` here to
avoid collision with other areas' `S-`/`G`-prefixed IDs; original file uses bare
`S-#`).

- **SET-1/SET-2/SET-3 (DATA_INTEGRITY_RISK):** `SettingsServiceImpl` persists under
  the **wrong Preferences node and wrong keys** versus legacy (`format.tv` vs.
  legacy's `rename.format.episode` under a different node entirely) — a real user's
  existing legacy preferences would never surface in the new Settings screen. It
  also uses raw `java.util.prefs.Preferences` instead of legacy's portable
  `FilePreferencesFactory`, falling back to the OS registry/plist rather than a
  flat, cross-platform-consistent file. **New requirement:** reuse
  `net.filebot.util.prefs.{FilePreferencesFactory,PropertyFileBackingStore,
  FilePreferences}` verbatim (three small, zero-dependency classes), and match
  legacy's exact node/key paths via `Settings.forPackage(Class).entry(String)`.
- **SET-6 (BROKEN_FUNCTIONALITY, likely a live bug):**
  `SettingsPanel.tsx:275` hardcodes `value="TVMAZE"` where the `ProviderType` union
  requires `'TV_MAZE'` — a type mismatch. Also only 5 of 8 `ProviderType` values are
  offered (missing OMDB, ACOUSTID, SHOOTER).
- **SET-7 (DATA_INTEGRITY_RISK):** provider credentials are stored in
  **plaintext**, directly contradicting this spec's own §B claim of "(encrypted in
  persistence layer)." No existing reusable encryption utility was found in
  `net.filebot` (`net.filebot.util.PGP` is signature-verification only, not
  applicable) — this needs new design (e.g. Electron `safeStorage`), not a direct
  port.
- **SET-13 (BROKEN_FUNCTIONALITY):** `AppShell.tsx` hardcodes a single global
  format expression and **never calls `settingsApi.getSettings()`** — none of the
  four saved format presets configured in this panel ever reach the Rename
  workspace. The Format Presets tab is functionally inert. Ties to specs/03
  addendum's per-type-format ambiguity — resolve both together.
- **Spec-accuracy flags needing product confirmation, not assumed either way:**
  §D's "Clear Application Cache Confirmation Modal" appears to conflate two
  unrelated legacy behaviors (an undiscoverable prefs-reset, and `MainFrame`'s
  separate confirmation-less `Ctrl+Shift+Delete` shortcut) — and critically, **no
  cache-clear endpoint exists anywhere in the port**, so the one legacy behavior
  that demonstrably exists today is entirely missing. `ui.theme`/`ui.language`
  preferences claimed in §A were not located anywhere in the audited legacy
  preference files. The full `License.java`/`LicenseModel.java` (277 lines
  combined) license-activation subsystem has zero port coverage and needs an
  explicit in/out-of-scope decision before being treated as a gap. Provider API
  keys are maintainer-baked into `application.properties` in legacy, not
  user-editable at all — confirm whether this spec's entire "Provider Credentials"
  UI is a deliberate, reasonable product improvement or solving a problem that
  didn't exist in the legacy UX model.
- Full gap table (S-1 through S-14) is in the audit file.
