package net.filebot.backend;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.filebot.WebServices;
import net.filebot.backend.domain.MatchStatus;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.web.EpisodeListProvider;
import net.filebot.web.MovieIdentificationService;
import net.filebot.web.TVMazeClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.ResponseEntity;

/**
 * Exercises the real TV episode-matching pipeline (spec 02 §2.2) end to end through the REST API,
 * with the TVmaze provider's HTTP calls intercepted by WireMock instead of hitting the real
 * api.tvmaze.com - so the test is deterministic and network-independent while still driving
 * {@code net.filebot.web.TVMazeClient}'s real request/response parsing and
 * {@code net.filebot.similarity.EpisodeMatcher}'s real SxE matching logic.
 *
 * <p>This is possible without touching {@link net.filebot.WebServices} because
 * {@link net.filebot.backend.service.RenameWorkspaceServiceImpl} now depends on the injectable
 * {@code Map<ProviderType, EpisodeListProvider>} bean from
 * {@link net.filebot.backend.config.ProviderClientConfig} rather than the static singleton
 * fields directly - a {@code @TestConfiguration} bean here supplies a {@code @Primary}
 * replacement map whose {@code TV_MAZE} entry points at the WireMock server.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class RenameWorkspaceWireMockTest {

  @RegisterExtension
  static WireMockExtension wireMock =
      WireMockExtension.newInstance().options(wireMockConfig().dynamicPort()).build();

  @Autowired private TestRestTemplate restTemplate;

  @TempDir Path tempDir;

  @TestConfiguration
  static class WireMockProviderConfig {

    @Bean
    @Primary
    public Map<ProviderType, EpisodeListProvider> wireMockEpisodeProviders() {
      Map<ProviderType, EpisodeListProvider> providers = new EnumMap<>(ProviderType.class);
      providers.put(ProviderType.TV_MAZE, new TestTvMazeClient(wireMock.baseUrl()));
      providers.put(ProviderType.THE_TVDB, WebServices.TheTVDB);
      providers.put(ProviderType.THE_MOVIE_DB, WebServices.TheMovieDB_TV);
      providers.put(ProviderType.ANI_DB, WebServices.AniDB);
      return providers;
    }

    @Bean
    @Primary
    public Map<ProviderType, MovieIdentificationService> wireMockMovieProviders() {
      Map<ProviderType, MovieIdentificationService> providers = new EnumMap<>(ProviderType.class);
      providers.put(ProviderType.OMDB, WebServices.OMDb);
      providers.put(ProviderType.THE_MOVIE_DB, WebServices.TheMovieDB);
      return providers;
    }
  }

  /** Routes TVMazeClient's real HTTP calls at the WireMock server and uses an isolated cache. */
  static class TestTvMazeClient extends TVMazeClient {
    private final String baseUrl;
    private final String cacheIdentifier =
        "TVmazeWireMockTest-" + UUID.randomUUID();

    TestTvMazeClient(String baseUrl) {
      this.baseUrl = baseUrl;
    }

    @Override
    public String getIdentifier() {
      return cacheIdentifier;
    }

    @Override
    protected URL getResource(String resource) throws Exception {
      return new URL(baseUrl + "/" + resource);
    }
  }

  @Test
  void autoMatch_realTvMazePipeline_matchesEpisodeViaWireMock() throws IOException {
    wireMock.stubFor(
        get(urlPathEqualTo("/search/shows"))
            .willReturn(
                aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody("[{\"show\":{\"id\":139,\"name\":\"Girls\"}}]")));
    wireMock.stubFor(
        get(urlPathEqualTo("/shows/139"))
            .willReturn(
                aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody(
                        "{\"id\":139,\"name\":\"Girls\",\"status\":\"Ended\","
                            + "\"premiered\":\"2012-04-15\",\"runtime\":30,\"genres\":[\"Drama\"],"
                            + "\"rating\":{\"average\":6.7}}")));
    wireMock.stubFor(
        get(urlPathEqualTo("/shows/139/episodes"))
            .willReturn(
                aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody(
                        "[{\"id\":1,\"season\":1,\"number\":1,\"name\":\"Pilot\","
                            + "\"airdate\":\"2012-04-15\"}]")));

    File file = tempDir.resolve("Girls.S01E01.mkv").toFile();
    Files.writeString(file.toPath(), "video bytes");

    MatchRequestDto request =
        new MatchRequestDto(
            List.of(file.getAbsolutePath()),
            ProviderType.TV_MAZE,
            MatchingMode.TV,
            null,
            "{n} - {s00e00} - {t}");

    ResponseEntity<MatchDto[]> response =
        restTemplate.postForEntity("/api/v1/rename/match", request, MatchDto[].class);

    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    MatchDto[] matches = response.getBody();
    assertThat(matches).hasSize(1);
    assertThat(matches[0].status()).isEqualTo(MatchStatus.MATCHED);
    assertThat(matches[0].targetMetadata()).isNotNull();
    assertThat(matches[0].score()).isGreaterThan(0.0);
    assertThat(matches[0].formattedName()).contains("Girls").contains("S01E01").contains("Pilot");

    wireMock.verify(getRequestedFor(urlPathEqualTo("/search/shows")));
    wireMock.verify(getRequestedFor(urlPathEqualTo("/shows/139/episodes")));
  }

  @Test
  void autoMatch_providerHttpError_fallsBackToPendingWithoutThrowing() throws IOException {
    wireMock.stubFor(get(urlPathEqualTo("/search/shows")).willReturn(aResponse().withStatus(500)));

    File file = tempDir.resolve("Some.Show.S02E03.mkv").toFile();
    Files.writeString(file.toPath(), "video bytes");

    MatchRequestDto request =
        new MatchRequestDto(
            List.of(file.getAbsolutePath()), ProviderType.TV_MAZE, MatchingMode.TV, null, "{n}");

    ResponseEntity<MatchDto[]> response =
        restTemplate.postForEntity("/api/v1/rename/match", request, MatchDto[].class);

    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    MatchDto[] matches = response.getBody();
    assertThat(matches).hasSize(1);
    assertThat(matches[0].status()).isEqualTo(MatchStatus.PENDING);
    assertThat(matches[0].targetMetadata()).isNull();
    assertThat(matches[0].score()).isEqualTo(0.0);
    // {n} evaluated against the bare File (no metadata) resolves via MediaBindingBean's
    // filename-based fallback (basename without extension) rather than throwing - the request
    // must never throw to the client either way (spec 02 §2.2/§2.3).
    assertThat(matches[0].formattedName())
        .isEqualTo(file.getName().substring(0, file.getName().lastIndexOf('.')));
  }
}
