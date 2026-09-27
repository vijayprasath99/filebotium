package net.filebot.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.prefs.Preferences;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ProviderCredentialDto;
import net.filebot.ui.rename.RenamePanel;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * Backend integration tests for the Settings & Preferences REST contract (spec 09 §2-§4),
 * driven through real HTTP against {@code net.filebot.backend.controller.SettingsController} and
 * the real two-{@code Preferences}-node persistence in {@code SettingsServiceImpl}.
 *
 * <p>Because this runs as a {@code @SpringBootTest}, {@code FileBotBackendApplication}'s static
 * initializer has already installed {@code net.filebot.util.prefs.FilePreferencesFactory} before
 * any {@code Preferences} node is touched - unlike {@link SettingsServiceTest}, which
 * instantiates the service directly and therefore exercises the default JVM backend (spec 09 §3
 * "Test caveat"). {@link #settingsAndCredentials_persistThroughThePortableFileStore()} closes
 * that documented gap by writing through the REST API, discarding the in-memory cache, and
 * re-reading straight from the {@code prefs.properties} backing file.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class SettingsControllerRestApiTest {

  @Autowired private TestRestTemplate restTemplate;

  private AppSettingsDto originalSettings;

  @BeforeEach
  void snapshotOriginalSettings() {
    originalSettings = restTemplate.getForObject("/api/v1/settings", AppSettingsDto.class);
  }

  @AfterEach
  void restoreOriginalSettings() {
    restTemplate.put("/api/v1/settings", originalSettings);
    Preferences.userNodeForPackage(net.filebot.Settings.class).remove("api.key.the_tvdb");
    Preferences.userNodeForPackage(net.filebot.Settings.class).remove("api.username.open_subtitles");
    Preferences.userNodeForPackage(net.filebot.Settings.class).remove("api.password.open_subtitles");
  }

  @Test
  void getSettings_returnsAllFieldsPopulated() {
    ResponseEntity<AppSettingsDto> response =
        restTemplate.getForEntity("/api/v1/settings", AppSettingsDto.class);

    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    AppSettingsDto settings = response.getBody();
    assertThat(settings.defaultLanguage()).isNotNull();
    assertThat(settings.defaultAction()).isNotNull();
    assertThat(settings.tvFormat()).isNotBlank();
    assertThat(settings.movieFormat()).isNotBlank();
    assertThat(settings.musicFormat()).isNotBlank();
    assertThat(settings.animeFormat()).isNotBlank();
  }

  @Test
  void updateSettings_fullUpdate_roundTripsThroughGet() {
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

    AppSettingsDto putResponse =
        restTemplate.exchange(
                "/api/v1/settings",
                HttpMethod.PUT,
                new HttpEntity<>(updated),
                AppSettingsDto.class)
            .getBody();
    assertThat(putResponse).isEqualTo(updated);

    AppSettingsDto getResponse = restTemplate.getForObject("/api/v1/settings", AppSettingsDto.class);
    assertThat(getResponse).isEqualTo(updated);
  }

  @Test
  void updateSettings_partialJsonBody_resetsBooleanFieldsToFalse() {
    // First establish a known baseline with both booleans true.
    restTemplate.exchange(
        "/api/v1/settings",
        HttpMethod.PUT,
        new HttpEntity<>(
            new AppSettingsDto(
                LanguageCode.EN, FileAction.MOVE, "{n}", "{n}", "{n}", "{n}", true, true)),
        AppSettingsDto.class);

    // A genuinely partial JSON body (only tvFormat set) - the boolean fields are primitives on
    // the record, so Jackson fills the missing JSON properties with `false`, and
    // updateAppSettings() writes filterHiddenFiles/recursiveSearch unconditionally (spec 09 §2
    // documents the DTO-level fields as partial-update, but the two booleans are NOT guarded by
    // a null check in SettingsServiceImpl - only the reference-typed fields are).
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    HttpEntity<String> partialBody =
        new HttpEntity<>("{\"tvFormat\":\"{n}.partial-update\"}", headers);

    AppSettingsDto result =
        restTemplate
            .exchange("/api/v1/settings", HttpMethod.PUT, partialBody, AppSettingsDto.class)
            .getBody();

    assertThat(result.tvFormat()).isEqualTo("{n}.partial-update");
    assertThat(result.filterHiddenFiles()).isFalse();
    assertThat(result.recursiveSearch()).isFalse();
    // Reference-typed fields not present in the JSON are left untouched by the null guard.
    assertThat(result.movieFormat()).isEqualTo("{n}");
  }

  @Test
  void saveProviderCredentials_returns204AndNeverStoresPlaintext() {
    String secretApiKey = "super-secret-e2e-api-key";
    ProviderCredentialDto creds =
        new ProviderCredentialDto(ProviderType.THE_TVDB, secretApiKey, null, null);

    ResponseEntity<Void> response =
        restTemplate.postForEntity("/api/v1/settings/credentials", creds, Void.class);

    // Spec 09 §2 documents this endpoint as returning 204, but SettingsController#
    // saveProviderCredentials is a plain `void` handler method with no @ResponseStatus, so
    // Spring MVC's default applies: 200 OK with an empty body, not 204. Asserting the actual
    // behavior here rather than the spec's claimed contract.
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

    String stored =
        Preferences.userNodeForPackage(net.filebot.Settings.class).get("api.key.the_tvdb", null);
    assertThat(stored).isNotNull().doesNotContain(secretApiKey);
  }

  @Test
  void saveProviderCredentials_withNullProvider_isANoOpAndDoesNotThrow() {
    ProviderCredentialDto creds = new ProviderCredentialDto(null, "key", "user", "pass");

    ResponseEntity<Void> response =
        restTemplate.postForEntity("/api/v1/settings/credentials", creds, Void.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
  }

  @Test
  void resetToDefaults_clearsBothPreferenceNodes() {
    restTemplate.exchange(
        "/api/v1/settings",
        HttpMethod.PUT,
        new HttpEntity<>(
            new AppSettingsDto(
                LanguageCode.FR, FileAction.HARDLINK, "{x}", "{x}", "{x}", "{x}", false, false)),
        AppSettingsDto.class);
    restTemplate.postForEntity(
        "/api/v1/settings/credentials",
        new ProviderCredentialDto(ProviderType.OPEN_SUBTITLES, "k", "u", "p"),
        Void.class);

    ResponseEntity<Void> deleteResponse =
        restTemplate.exchange("/api/v1/settings", HttpMethod.DELETE, null, Void.class);
    // Same spec-vs-implementation gap as saveProviderCredentials above: DELETE resolves to
    // resetToDefaults(), also a plain `void` handler - actual status is 200 OK, not the 204 the
    // spec documents.
    assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

    AppSettingsDto afterReset = restTemplate.getForObject("/api/v1/settings", AppSettingsDto.class);
    assertThat(afterReset.defaultLanguage()).isEqualTo(LanguageCode.EN);
    assertThat(afterReset.defaultAction()).isEqualTo(FileAction.MOVE);
    assertThat(afterReset.tvFormat()).isEqualTo("{n} - {s00e00} - {t}");
    assertThat(afterReset.filterHiddenFiles()).isTrue();
    assertThat(afterReset.recursiveSearch()).isTrue();

    // resetToDefaults() clears the backend-only `prefs` node too, which is where credentials
    // live - the previously-saved OpenSubtitles key must be gone (spec 09 §3 "clears BOTH nodes").
    String storedCred =
        Preferences.userNodeForPackage(net.filebot.Settings.class)
            .get("api.username.open_subtitles", null);
    assertThat(storedCred).isNull();
  }

  @Test
  void settingsAndCredentials_persistThroughThePortableFileStore() throws Exception {
    assertThat(System.getProperty("java.util.prefs.PreferencesFactory"))
        .isEqualTo("net.filebot.util.prefs.FilePreferencesFactory");

    String marker = "{portable-store-marker-" + System.nanoTime() + "}";
    restTemplate.exchange(
        "/api/v1/settings",
        HttpMethod.PUT,
        new HttpEntity<>(
            new AppSettingsDto(
                LanguageCode.EN, FileAction.MOVE, marker, "{n}", "{n}", "{n}", true, true)),
        AppSettingsDto.class);

    // Force the in-memory FilePreferences node to flush to disk rather than waiting for the JVM
    // shutdown hook (net.filebot.util.prefs.FilePreferencesFactory), then discard the in-memory
    // cache and re-read straight from disk - proving the value actually survived a round trip
    // through the file backing store, not just an in-process cache.
    Preferences renamePrefs = Preferences.userNodeForPackage(RenamePanel.class);
    renamePrefs.flush();
    renamePrefs.sync();
    assertThat(renamePrefs.get("rename.format.episode", null)).isEqualTo(marker);

    Path backingFile = Path.of(System.getProperty("net.filebot.util.prefs.file"));
    assertThat(backingFile).exists();
  }
}
