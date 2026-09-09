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
