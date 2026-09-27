package net.filebot.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.PresetDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

/**
 * REST-level coverage of the Preset Manager CRUD contract (spec 02 §5), hitting
 * {@code net.filebot.backend.controller.PresetController} over real HTTP rather than calling the
 * service layer directly.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class PresetControllerRestApiTest {

  private static final String TEST_PRESET_NAME = "__rest_api_test_preset__";

  @Autowired private TestRestTemplate restTemplate;

  @AfterEach
  void cleanup() {
    restTemplate.delete("/api/v1/presets/" + TEST_PRESET_NAME);
  }

  @Test
  void saveListAndDeletePreset_roundTripsOverRestApi() {
    PresetDto preset =
        new PresetDto(
            TEST_PRESET_NAME,
            "{n} - {s00e00} - {t}",
            ProviderType.THE_TVDB,
            MatchingMode.TV,
            LanguageCode.EN,
            FileAction.MOVE);

    ResponseEntity<PresetDto> saveResponse =
        restTemplate.postForEntity("/api/v1/presets", preset, PresetDto.class);
    assertThat(saveResponse.getStatusCode().is2xxSuccessful()).isTrue();
    assertThat(saveResponse.getBody().name()).isEqualTo(TEST_PRESET_NAME);

    PresetDto[] afterSave = restTemplate.getForObject("/api/v1/presets", PresetDto[].class);
    assertThat(afterSave).extracting(PresetDto::name).contains(TEST_PRESET_NAME);

    PresetDto saved =
        List.of(afterSave).stream()
            .filter(p -> p.name().equals(TEST_PRESET_NAME))
            .findFirst()
            .orElseThrow();
    assertThat(saved.formatExpression()).isEqualTo("{n} - {s00e00} - {t}");
    assertThat(saved.provider()).isEqualTo(ProviderType.THE_TVDB);
    assertThat(saved.mode()).isEqualTo(MatchingMode.TV);
    assertThat(saved.action()).isEqualTo(FileAction.MOVE);

    restTemplate.delete("/api/v1/presets/" + TEST_PRESET_NAME);

    PresetDto[] afterDelete = restTemplate.getForObject("/api/v1/presets", PresetDto[].class);
    assertThat(afterDelete).extracting(PresetDto::name).doesNotContain(TEST_PRESET_NAME);
  }

  @Test
  void savingPresetWithSameNameOverwritesPreviousValue() {
    PresetDto original =
        new PresetDto(
            TEST_PRESET_NAME, "{n}", ProviderType.THE_TVDB, MatchingMode.TV, LanguageCode.EN, FileAction.MOVE);
    PresetDto updated =
        new PresetDto(
            TEST_PRESET_NAME,
            "{n} ({y})",
            ProviderType.THE_MOVIE_DB,
            MatchingMode.MOVIE,
            LanguageCode.EN,
            FileAction.COPY);

    restTemplate.postForEntity("/api/v1/presets", original, PresetDto.class);
    restTemplate.postForEntity("/api/v1/presets", updated, PresetDto.class);

    PresetDto[] presets = restTemplate.getForObject("/api/v1/presets", PresetDto[].class);
    long matches =
        List.of(presets).stream().filter(p -> p.name().equals(TEST_PRESET_NAME)).count();
    assertThat(matches).isEqualTo(1);

    PresetDto current =
        List.of(presets).stream()
            .filter(p -> p.name().equals(TEST_PRESET_NAME))
            .findFirst()
            .orElseThrow();
    assertThat(current.formatExpression()).isEqualTo("{n} ({y})");
    assertThat(current.provider()).isEqualTo(ProviderType.THE_MOVIE_DB);
  }

  @Test
  void deletingUnknownPresetIsANoOp() {
    ResponseEntity<Void> response =
        restTemplate.exchange(
            "/api/v1/presets/__does_not_exist__", HttpMethod.DELETE, null, Void.class);
    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
  }
}
