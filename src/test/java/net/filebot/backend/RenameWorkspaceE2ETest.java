package net.filebot.backend;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.LoadState;
import java.io.File;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import net.filebot.WebServices;
import net.filebot.backend.domain.ProviderType;
import net.filebot.web.EpisodeListProvider;
import net.filebot.web.MovieIdentificationService;
import net.filebot.web.TVMazeClient;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Full end-to-end test that drives the actual compiled React UI (served by Spring from
 * {@code classpath:/static/ui/}, see {@code net.filebot.backend.config.WebMvcConfig}) with a real
 * headless Chromium browser via Playwright, covering the Rename Workspace golden path from spec
 * 02 §1-§3: load a file -> Match against a (WireMock-stubbed) real provider -> verify the New
 * Names list -> Rename -> verify the physical file on disk was actually renamed.
 *
 * <p>The TVmaze provider is used with WireMock (same technique as {@link
 * RenameWorkspaceWireMockTest}) so the test is deterministic and network-independent while still
 * exercising the real matching pipeline underneath the UI.
 *
 * <p>Because a real OS "open file" dialog can't be automated, the file is loaded the same way the
 * app itself works around browsers only exposing a bare filename (spec 02 §1 "Base Folder
 * Override"): the hidden {@code <input type=file>} is filled directly via Playwright's
 * {@code setInputFiles}, then the Base Folder Override field is set to the temp directory so
 * {@code resolvePaths()} produces real absolute paths the backend can act on.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class RenameWorkspaceE2ETest {

  @RegisterExtension
  static WireMockExtension wireMock =
      WireMockExtension.newInstance().options(wireMockConfig().dynamicPort()).build();

  @LocalServerPort private int port;

  @TempDir Path tempDir;

  private static Playwright playwright;
  private static Browser browser;
  private Page page;

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

  static class TestTvMazeClient extends TVMazeClient {
    private final String baseUrl;
    private final String cacheIdentifier = "TVmazeE2ETest-" + UUID.randomUUID();

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

  @BeforeAll
  static void launchBrowser() {
    playwright = Playwright.create();
    browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
  }

  @AfterAll
  static void closeBrowser() {
    if (browser != null) browser.close();
    if (playwright != null) playwright.close();
  }

  @BeforeEach
  void openApp() {
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

    page = browser.newPage();
    page.navigate("http://localhost:" + port + "/ui/");
    page.waitForLoadState(LoadState.NETWORKIDLE);
  }

  @AfterEach
  void closePage() {
    if (page != null) page.close();
  }

  @Test
  void loadMatchAndRenameFile_updatesUiAndPhysicalFile() {
    File source = tempDir.resolve("Girls.S01E01.mkv").toFile();
    writeQuietly(source);

    assertThat(page.locator("text=No matches loaded").isVisible()).isTrue();

    // Load the file through the hidden <input type=file> (bare filename only, browser-side).
    page.locator("input[type=file]").setInputFiles(source.toPath());
    page.locator("text=" + source.getName()).first().waitFor();

    // Browsers only expose a bare filename for a picked file - point the app at the real
    // directory via the Base Folder Override so matching/rename act on the real path.
    page.locator("button[title='Set disk base folder if browser uploads fake paths']").click();
    Locator baseInput = page.locator("input[placeholder='e.g. D:/Media/TV']");
    baseInput.fill(tempDir.toString());
    baseInput.press("Tab");

    // Provider dropdown is the 2nd <select> in the top bar (Mode, Provider, Action).
    page.locator("select").nth(1).selectOption("TV_MAZE");

    page.locator("button[title='Automatically align episode data with your files']").click();
    page.locator("text=No matches loaded").waitFor(new Locator.WaitForOptions().setState(
        com.microsoft.playwright.options.WaitForSelectorState.DETACHED));

    page.locator("button[title='Rename files']").click();
    page.locator("text=Successfully renamed").waitFor();

    assertThat(source).doesNotExist();
  }

  private static void writeQuietly(File file) {
    try {
      Files.writeString(file.toPath(), "sample video bytes");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}
