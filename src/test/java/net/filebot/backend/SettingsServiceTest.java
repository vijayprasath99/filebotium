package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ProviderCredentialDto;
import net.filebot.backend.service.SettingsService;
import net.filebot.backend.service.SettingsServiceImpl;
import org.junit.jupiter.api.Test;

public class SettingsServiceTest {

  private final SettingsService service = new SettingsServiceImpl();

  @Test
  public void testGetAndUpdateAppSettings() {
    AppSettingsDto initial = service.getAppSettings();
    assertNotNull(initial);

    AppSettingsDto updated =
        new AppSettingsDto(
            LanguageCode.DE,
            FileAction.COPY,
            "{n} - {s00e00}",
            "{n} ({y})",
            "{artist}/{t}",
            "{n} - {absolute}",
            false,
            false);

    AppSettingsDto result = service.updateAppSettings(updated);
    assertNotNull(result);
    assertEquals(LanguageCode.DE, result.defaultLanguage());
    assertEquals(FileAction.COPY, result.defaultAction());
  }

  @Test
  public void testSaveProviderCredentials() {
    ProviderCredentialDto creds =
        new ProviderCredentialDto(ProviderType.OPEN_SUBTITLES, "my-key", "user1", "pass1");
    service.saveProviderCredentials(creds);
  }
}
