package net.filebot.backend.service;

import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ProviderCredentialDto;

public interface SettingsService {
  AppSettingsDto getAppSettings();

  AppSettingsDto updateAppSettings(AppSettingsDto settings);

  void saveProviderCredentials(ProviderCredentialDto credentials);

  void resetToDefaults();
}
