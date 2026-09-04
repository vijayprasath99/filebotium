package net.filebot.backend.service;

import java.util.prefs.Preferences;
import net.filebot.Settings;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ProviderCredentialDto;

public class SettingsServiceImpl implements SettingsService {

  private final Preferences prefs = Preferences.userNodeForPackage(Settings.class);

  @Override
  public AppSettingsDto getAppSettings() {
    String lang = prefs.get("language.default", "EN");
    String action = prefs.get("action.default", "MOVE");
    String tvFormat = prefs.get("format.tv", "{n} - {s00e00} - {t}");
    String movieFormat = prefs.get("format.movie", "{n} ({y})/{n} ({y})");
    String musicFormat = prefs.get("format.music", "{artist} - {album}/{pi} - {t}");
    String animeFormat = prefs.get("format.anime", "{n} - {absolute} - {t}");
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
      prefs.put("language.default", settings.defaultLanguage().name());
    }
    if (settings.defaultAction() != null) {
      prefs.put("action.default", settings.defaultAction().name());
    }
    if (settings.tvFormat() != null) {
      prefs.put("format.tv", settings.tvFormat());
    }
    if (settings.movieFormat() != null) {
      prefs.put("format.movie", settings.movieFormat());
    }
    if (settings.musicFormat() != null) {
      prefs.put("format.music", settings.musicFormat());
    }
    if (settings.animeFormat() != null) {
      prefs.put("format.anime", settings.animeFormat());
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
      prefs.put("api.key." + key, credentials.apiKey());
    }
    if (credentials.username() != null) {
      prefs.put("api.username." + key, credentials.username());
    }
    if (credentials.password() != null) {
      prefs.put("api.password." + key, credentials.password());
    }
  }

  @Override
  public void resetToDefaults() {
    try {
      prefs.clear();
    } catch (Exception e) {
      // Ignore clear error
    }
  }
}
