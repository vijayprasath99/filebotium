package net.filebot.backend.controller;

import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ProviderCredentialDto;
import net.filebot.backend.service.SettingsService;

public class SettingsController {

  private final SettingsService settingsService;

  public SettingsController(SettingsService settingsService) {
    this.settingsService = settingsService;
  }

  public AppSettingsDto getAppSettings() {
    return settingsService.getAppSettings();
  }

  public AppSettingsDto updateAppSettings(AppSettingsDto settings) {
    return settingsService.updateAppSettings(settings);
  }

  public void saveProviderCredentials(ProviderCredentialDto credentials) {
    settingsService.saveProviderCredentials(credentials);
  }

  public void resetToDefaults() {
    settingsService.resetToDefaults();
  }
}
