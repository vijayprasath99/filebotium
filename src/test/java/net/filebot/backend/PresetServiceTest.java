package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.PresetDto;
import net.filebot.backend.service.PresetService;
import net.filebot.backend.service.PresetServiceImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

public class PresetServiceTest {

  private final PresetService service = new PresetServiceImpl();
  private static final String TEST_PRESET_NAME = "__test_preset__";

  @AfterEach
  public void cleanup() {
    service.deletePreset(TEST_PRESET_NAME);
  }

  @Test
  public void testSaveAndListPreset() {
    PresetDto preset =
        new PresetDto(
            TEST_PRESET_NAME,
            "{n} - {s00e00} - {t}",
            ProviderType.THE_TVDB,
            MatchingMode.TV,
            LanguageCode.EN,
            FileAction.MOVE);

    service.savePreset(preset);

    List<PresetDto> presets = service.listPresets();
    assertTrue(presets.stream().anyMatch(p -> p.name().equals(TEST_PRESET_NAME)));

    PresetDto found = presets.stream().filter(p -> p.name().equals(TEST_PRESET_NAME)).findFirst().get();
    assertEquals("{n} - {s00e00} - {t}", found.formatExpression());
    assertEquals(ProviderType.THE_TVDB, found.provider());
    assertEquals(MatchingMode.TV, found.mode());
    assertEquals(LanguageCode.EN, found.language());
    assertEquals(FileAction.MOVE, found.action());
  }

  @Test
  public void testDeletePreset() {
    service.savePreset(
        new PresetDto(TEST_PRESET_NAME, "{n}", null, null, null, null));
    service.deletePreset(TEST_PRESET_NAME);

    List<PresetDto> presets = service.listPresets();
    assertFalse(presets.stream().anyMatch(p -> p.name().equals(TEST_PRESET_NAME)));
  }
}
