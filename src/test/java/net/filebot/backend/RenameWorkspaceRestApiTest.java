package net.filebot.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import net.filebot.backend.domain.ConflictStrategy;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.MatchStatus;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.backend.dto.MediaFileDto;
import net.filebot.backend.dto.RenameExecutionRequestDto;
import net.filebot.backend.dto.RenameExecutionResultDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Backend integration tests for the Rename Workspace REST contract (spec 02 §2-§3), driven
 * through real HTTP calls against the Spring REST controllers/service layer - no UI involved.
 *
 * <p>These tests avoid depending on the real TheTVDB/TMDb/etc. network APIs by using {@code
 * MatchingMode.MUSIC} (a documented, deterministic no-op branch - spec 02 §6) to produce
 * PENDING matches without any provider I/O, so the assertions here are reproducible with or
 * without outbound network access. See {@link RenameWorkspaceWireMockTest} for the WireMock-based
 * coverage of the real episode-matching pipeline.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class RenameWorkspaceRestApiTest {

  @Autowired private TestRestTemplate restTemplate;

  @TempDir Path tempDir;

  private String baseUrl() {
    return "/api/v1/rename";
  }

  @Test
  void match_musicMode_isDeterministicNoOpFallback() throws IOException {
    File file = tempDir.resolve("Unknown.Artist.Track.mp3").toFile();
    Files.writeString(file.toPath(), "audio bytes");

    MatchRequestDto request =
        new MatchRequestDto(List.of(file.getAbsolutePath()), null, MatchingMode.MUSIC, null, null);

    ResponseEntity<MatchDto[]> response =
        restTemplate.postForEntity(baseUrl() + "/match", request, MatchDto[].class);

    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    MatchDto[] matches = response.getBody();
    assertThat(matches).hasSize(1);
    assertThat(matches[0].targetMetadata()).isNull();
    assertThat(matches[0].status()).isEqualTo(MatchStatus.PENDING);
    assertThat(matches[0].score()).isEqualTo(0.0);
    assertThat(matches[0].formattedName()).isEqualTo(file.getName());
  }

  @Test
  void match_appliesFormatExpressionEvenWithoutMetadata() throws IOException {
    File file = tempDir.resolve("some.file.mkv").toFile();
    Files.writeString(file.toPath(), "x");

    MatchRequestDto request =
        new MatchRequestDto(
            List.of(file.getAbsolutePath()), null, MatchingMode.MUSIC, null, "{fn}.renamed");

    MatchDto[] matches =
        restTemplate.postForObject(baseUrl() + "/match", request, MatchDto[].class);

    assertThat(matches).hasSize(1);
    // {fn} = basename without extension.
    assertThat(matches[0].formattedName()).isEqualTo("some.file.renamed");
  }

  @Test
  void align_swapsAdjacentRows() throws IOException {
    List<MatchDto> matches = buildMatches("a.mkv", "b.mkv", "c.mkv");

    ResponseEntity<MatchDto[]> response =
        restTemplate.postForEntity(
            baseUrl() + "/align?sourceIndex=0&targetIndex=1", matches, MatchDto[].class);

    MatchDto[] reordered = response.getBody();
    assertThat(reordered).hasSize(3);
    assertThat(reordered[0].sourceFile().name()).isEqualTo("b.mkv");
    assertThat(reordered[1].sourceFile().name()).isEqualTo("a.mkv");
    assertThat(reordered[2].sourceFile().name()).isEqualTo("c.mkv");
  }

  @Test
  void format_reappliesExpressionToNonExcludedRowsOnly() throws IOException {
    List<MatchDto> matches = buildMatches("a.mkv", "b.mkv");
    MatchDto excluded = matches.get(1);
    matches =
        List.of(
            matches.get(0),
            new MatchDto(
                excluded.matchId(),
                excluded.sourceFile(),
                excluded.targetMetadata(),
                excluded.score(),
                excluded.formattedName(),
                excluded.formattedPath(),
                true,
                excluded.status()));

    java.net.URI uri =
        UriComponentsBuilder.fromUriString(restTemplate.getRootUri() + baseUrl() + "/format")
            .queryParam("formatExpression", "{fn}.reformatted")
            .build()
            .encode()
            .toUri();
    ResponseEntity<MatchDto[]> response =
        restTemplate.exchange(
            uri, HttpMethod.POST, new HttpEntity<>(matches), MatchDto[].class);

    MatchDto[] formatted = response.getBody();
    assertThat(formatted).hasSize(2);
    assertThat(formatted[0].formattedName()).isEqualTo("a.reformatted");
    // Excluded row must be skipped by applyFormat (spec 02 §1) - its name is unchanged.
    assertThat(formatted[1].formattedName()).isEqualTo(excluded.formattedName());
    assertThat(formatted[1].isExcluded()).isTrue();
  }

  @Test
  void execute_moveActionRenamesFileOnDisk() throws IOException {
    File source = tempDir.resolve("source.mkv").toFile();
    Files.writeString(source.toPath(), "video content");
    List<MatchDto> matches = buildMatches(source.getName());
    File target = tempDir.resolve(matches.get(0).formattedName() + ".renamed").toFile();
    MatchDto renamedTarget = withFormattedPath(matches.get(0), target);

    RenameExecutionRequestDto request =
        new RenameExecutionRequestDto(
            List.of(renamedTarget), FileAction.MOVE, ConflictStrategy.OVERWRITE);

    RenameExecutionResultDto result =
        restTemplate.postForObject(baseUrl() + "/execute", request, RenameExecutionResultDto.class);

    assertThat(result.successCount()).isEqualTo(1);
    assertThat(result.failureCount()).isEqualTo(0);
    assertThat(source).doesNotExist();
    assertThat(target).exists();
  }

  @Test
  void execute_excludedMatchIsSkipped() throws IOException {
    File source = tempDir.resolve("excluded.mkv").toFile();
    Files.writeString(source.toPath(), "content");
    MatchDto match = buildMatches(source.getName()).get(0);
    File target = tempDir.resolve("excluded.renamed.mkv").toFile();
    MatchDto excludedMatch =
        new MatchDto(
            match.matchId(),
            match.sourceFile(),
            match.targetMetadata(),
            match.score(),
            target.getName(),
            target.getAbsolutePath(),
            true,
            match.status());

    RenameExecutionRequestDto request =
        new RenameExecutionRequestDto(
            List.of(excludedMatch), FileAction.MOVE, ConflictStrategy.OVERWRITE);

    RenameExecutionResultDto result =
        restTemplate.postForObject(baseUrl() + "/execute", request, RenameExecutionResultDto.class);

    assertThat(result.successCount()).isEqualTo(0);
    assertThat(result.failureCount()).isEqualTo(0);
    assertThat(source).exists();
    assertThat(target).doesNotExist();
  }

  @Test
  void execute_missingSourceFileRecordsPerFileError() {
    File missingSource = tempDir.resolve("does-not-exist.mkv").toFile();
    MediaFileDto sourceDto =
        new MediaFileDto(
            "id-1",
            missingSource.getAbsolutePath(),
            missingSource.getName(),
            "mkv",
            0,
            java.time.Instant.now(),
            tempDir.toString(),
            false,
            null,
            java.util.Map.of());
    File target = tempDir.resolve("renamed.mkv").toFile();
    MatchDto match =
        new MatchDto(
            "match-1",
            sourceDto,
            null,
            0.0,
            target.getName(),
            target.getAbsolutePath(),
            false,
            MatchStatus.PENDING);

    RenameExecutionRequestDto request =
        new RenameExecutionRequestDto(List.of(match), FileAction.MOVE, ConflictStrategy.OVERWRITE);

    RenameExecutionResultDto result =
        restTemplate.postForObject(baseUrl() + "/execute", request, RenameExecutionResultDto.class);

    assertThat(result.successCount()).isEqualTo(0);
    assertThat(result.failureCount()).isEqualTo(1);
    assertThat(result.errors()).hasSize(1);
    assertThat(result.errors().get(0).errorMessage()).contains("does not exist");
  }

  private List<MatchDto> buildMatches(String... fileNames) throws IOException {
    List<String> paths = new java.util.ArrayList<>();
    for (String name : fileNames) {
      File f = tempDir.resolve(name).toFile();
      if (!f.exists()) {
        Files.writeString(f.toPath(), "x");
      }
      paths.add(f.getAbsolutePath());
    }
    MatchRequestDto request = new MatchRequestDto(paths, null, MatchingMode.MUSIC, null, null);
    ResponseEntity<MatchDto[]> response =
        restTemplate.postForEntity(baseUrl() + "/match", request, MatchDto[].class);
    return List.of(response.getBody());
  }

  private MatchDto withFormattedPath(MatchDto match, File target) {
    return new MatchDto(
        match.matchId(),
        match.sourceFile(),
        match.targetMetadata(),
        match.score(),
        target.getName(),
        target.getAbsolutePath(),
        match.isExcluded(),
        match.status());
  }
}
