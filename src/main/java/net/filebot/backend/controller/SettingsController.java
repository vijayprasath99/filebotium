package net.filebot.backend.controller;

import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ProviderCredentialDto;
import net.filebot.backend.service.SettingsService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings")
public class SettingsController {

  private final SettingsService settingsService;

  public SettingsController(SettingsService settingsService) {
    this.settingsService = settingsService;
  }

  @GetMapping
  public AppSettingsDto getAppSettings() {
    return settingsService.getAppSettings();
  }

  @PutMapping
  public AppSettingsDto updateAppSettings(@RequestBody AppSettingsDto settings) {
    return settingsService.updateAppSettings(settings);
  }

  @PostMapping("/credentials")
  public void saveProviderCredentials(@RequestBody ProviderCredentialDto credentials) {
    settingsService.saveProviderCredentials(credentials);
  }

  @DeleteMapping
  public void resetToDefaults() {
    settingsService.resetToDefaults();
  }
}
