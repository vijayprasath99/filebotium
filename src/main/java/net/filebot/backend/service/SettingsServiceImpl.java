package net.filebot.backend.service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.prefs.Preferences;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import net.filebot.ApplicationFolder;
import net.filebot.Settings;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ProviderCredentialDto;
import net.filebot.ui.rename.RenamePanel;
import org.springframework.stereotype.Service;

@Service
public class SettingsServiceImpl implements SettingsService {

  // Legacy persists rename format/language preferences under RenamePanel's own node
  // (net/filebot/ui/rename), not a generic "net/filebot" node - matching this node/key layout
  // means a user's existing ~/.filebot prefs surface correctly in this Settings screen
  // (specs/audit/09_settings_audit.md SET-1/SET-3).
  private final Preferences renamePrefs = Preferences.userNodeForPackage(RenamePanel.class);

  // Settings with no legacy user-facing equivalent (defaultAction, hidden-file/recursive
  // intake toggles) live under this backend's own node.
  private final Preferences prefs = Preferences.userNodeForPackage(Settings.class);

  @Override
  public AppSettingsDto getAppSettings() {
    String lang = renamePrefs.get("rename.language", "en");
    String action = prefs.get("action.default", "MOVE");
    String tvFormat = renamePrefs.get("rename.format.episode", "{n} - {s00e00} - {t}");
    String movieFormat = renamePrefs.get("rename.format.movie", "{n} ({y})/{n} ({y})");
    String musicFormat = renamePrefs.get("rename.format.music", "{artist} - {album}/{pi} - {t}");
    // Legacy's 4th format slot is generic "File" mode, not Anime-specific (specs/audit/
    // 09_settings_audit.md SET-12) - the on-disk key stays rename.format.file for parity even
    // though this DTO field is named animeFormat throughout the rest of the app.
    String animeFormat = renamePrefs.get("rename.format.file", "{n} - {absolute} - {t}");
    boolean filterHidden = prefs.getBoolean("file.filter.hidden", true);
    boolean recursive = prefs.getBoolean("file.search.recursive", true);

    LanguageCode languageCode = LanguageCode.EN;
    try {
      languageCode = LanguageCode.valueOf(lang.toUpperCase());
    } catch (Exception e) {
      // Default
    }

    FileAction fileAction = FileAction.MOVE;
    try {
      fileAction = FileAction.valueOf(action.toUpperCase());
    } catch (Exception e) {
      // Default
    }

    return new AppSettingsDto(
        languageCode,
        fileAction,
        tvFormat,
        movieFormat,
        musicFormat,
        animeFormat,
        filterHidden,
        recursive);
  }

  @Override
  public AppSettingsDto updateAppSettings(AppSettingsDto settings) {
    if (settings == null) {
      return getAppSettings();
    }

    if (settings.defaultLanguage() != null) {
      renamePrefs.put("rename.language", settings.defaultLanguage().name().toLowerCase());
    }
    if (settings.defaultAction() != null) {
      prefs.put("action.default", settings.defaultAction().name());
    }
    if (settings.tvFormat() != null) {
      renamePrefs.put("rename.format.episode", settings.tvFormat());
    }
    if (settings.movieFormat() != null) {
      renamePrefs.put("rename.format.movie", settings.movieFormat());
    }
    if (settings.musicFormat() != null) {
      renamePrefs.put("rename.format.music", settings.musicFormat());
    }
    if (settings.animeFormat() != null) {
      renamePrefs.put("rename.format.file", settings.animeFormat());
    }
    prefs.putBoolean("file.filter.hidden", settings.filterHiddenFiles());
    prefs.putBoolean("file.search.recursive", settings.recursiveSearch());

    return getAppSettings();
  }

  @Override
  public void saveProviderCredentials(ProviderCredentialDto credentials) {
    if (credentials == null || credentials.provider() == null) {
      return;
    }
    String key = credentials.provider().name().toLowerCase();
    if (credentials.apiKey() != null) {
      prefs.put("api.key." + key, CredentialCipher.encrypt(credentials.apiKey()));
    }
    if (credentials.username() != null) {
      prefs.put("api.username." + key, CredentialCipher.encrypt(credentials.username()));
    }
    if (credentials.password() != null) {
      prefs.put("api.password." + key, CredentialCipher.encrypt(credentials.password()));
    }
  }

  @Override
  public void resetToDefaults() {
    try {
      prefs.clear();
    } catch (Exception e) {
      // Ignore clear error
    }
    try {
      renamePrefs.clear();
    } catch (Exception e) {
      // Ignore clear error
    }
  }

  /**
   * Encrypts provider credentials at rest with a locally-generated AES-256-GCM key (stored
   * owner-only under ~/.filebot), so ~/.filebot/prefs.properties never contains plaintext API
   * keys/passwords (specs/audit/09_settings_audit.md SET-7). This is a backend-only mitigation:
   * a full solution living in the Electron shell (OS keychain / safeStorage) is a separate,
   * larger design decision - see specs/DETAILED_IMPLEMENTATION_PLAN.md Phase 4.4.
   */
  private static final class CredentialCipher {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int IV_LENGTH_BYTES = 12;

    private static SecretKeySpec key;

    private static synchronized SecretKeySpec key() {
      if (key == null) {
        key = new SecretKeySpec(loadOrCreateKeyBytes(), "AES");
      }
      return key;
    }

    private static byte[] loadOrCreateKeyBytes() {
      File keyFile = ApplicationFolder.AppData.resolve("credentials.key");
      try {
        if (keyFile.exists()) {
          return Files.readAllBytes(keyFile.toPath());
        }
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        keyFile.getParentFile().mkdirs();
        Files.write(keyFile.toPath(), bytes);
        keyFile.setReadable(false, false);
        keyFile.setWritable(false, false);
        keyFile.setReadable(true, true);
        keyFile.setWritable(true, true);
        return bytes;
      } catch (Exception e) {
        // Fall back to a process-local key if the key file cannot be persisted - credentials
        // are still never written to disk in plaintext, they just won't survive a restart.
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return bytes;
      }
    }

    static String encrypt(String plaintext) {
      try {
        byte[] iv = new byte[IV_LENGTH_BYTES];
        new SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        byte[] combined = new byte[iv.length + ciphertext.length];
        System.arraycopy(iv, 0, combined, 0, iv.length);
        System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);
        return Base64.getEncoder().encodeToString(combined);
      } catch (Exception e) {
        throw new IllegalStateException("Failed to encrypt credential", e);
      }
    }
  }
}
