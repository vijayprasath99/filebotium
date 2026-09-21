package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import net.filebot.backend.domain.ChecksumStatus;
import net.filebot.backend.domain.HashType;
import net.filebot.backend.dto.ChecksumEntryDto;
import net.filebot.backend.dto.ChecksumExportRequestDto;
import net.filebot.backend.dto.ChecksumVerificationRequestDto;
import net.filebot.backend.dto.ChecksumVerificationResultDto;
import net.filebot.backend.service.ChecksumService;
import net.filebot.backend.service.ChecksumServiceImpl;
import org.junit.jupiter.api.Test;

public class ChecksumServiceTest {

  private final ChecksumService service = new ChecksumServiceImpl();

  @Test
  public void testStartVerificationTaskWithMissingFile() {
    ChecksumVerificationRequestDto req =
        new ChecksumVerificationRequestDto(List.of("file1.mkv"), HashType.CRC32, null);
    ChecksumVerificationResultDto result = service.startVerificationTask(req);
    assertNotNull(result.taskId());
    assertFalse(result.taskId().isEmpty());
    assertEquals(1, result.entries().size());
    assertEquals(ChecksumStatus.MISSING, result.entries().get(0).status());
  }

  @Test
  public void testStartVerificationTaskComputesRealHashAndDetectsMismatch() throws Exception {
    File tempFile = File.createTempFile("checksum_", ".bin");
    tempFile.deleteOnExit();
    try (FileWriter writer = new FileWriter(tempFile, StandardCharsets.UTF_8)) {
      writer.write("hello world");
    }

    // compute the real hash first (no expected value supplied)
    ChecksumVerificationRequestDto probe =
        new ChecksumVerificationRequestDto(List.of(tempFile.getAbsolutePath()), HashType.CRC32, null);
    ChecksumVerificationResultDto probeResult = service.startVerificationTask(probe);
    String realHash = probeResult.entries().get(0).calculatedHash();
    assertNotNull(realHash);

    ChecksumVerificationRequestDto matching =
        new ChecksumVerificationRequestDto(
            List.of(tempFile.getAbsolutePath()),
            HashType.CRC32,
            null,
            java.util.Map.of(tempFile.getAbsolutePath(), realHash));
    ChecksumVerificationResultDto matchingResult = service.startVerificationTask(matching);
    assertEquals(ChecksumStatus.OK, matchingResult.entries().get(0).status());

    ChecksumVerificationRequestDto mismatching =
        new ChecksumVerificationRequestDto(
            List.of(tempFile.getAbsolutePath()),
            HashType.CRC32,
            null,
            java.util.Map.of(tempFile.getAbsolutePath(), "FFFFFFFF"));
    ChecksumVerificationResultDto mismatchResult = service.startVerificationTask(mismatching);
    assertEquals(ChecksumStatus.MISMATCH, mismatchResult.entries().get(0).status());
  }

  @Test
  public void testParseVerificationFile() throws Exception {
    File tempSfv = File.createTempFile("test_", ".sfv");
    tempSfv.deleteOnExit();

    try (FileWriter writer = new FileWriter(tempSfv, StandardCharsets.UTF_8)) {
      writer.write("; SFV Comment\nvideo1.mkv 8A4F32C1\n");
    }

    List<ChecksumEntryDto> entries = service.parseVerificationFile(tempSfv.getAbsolutePath());
    assertNotNull(entries);
    assertEquals(1, entries.size());
    assertEquals("8A4F32C1", entries.get(0).expectedHash());
  }

  @Test
  public void testGenerateVerificationFileContent() {
    ChecksumEntryDto entry =
        new ChecksumEntryDto(
            "video.mkv", "12345678", "12345678", HashType.CRC32, ChecksumStatus.OK);
    ChecksumExportRequestDto req =
        new ChecksumExportRequestDto(List.of(entry), HashType.CRC32, null);

    String content = service.generateVerificationFileContent(req);
    assertNotNull(content);
    assertTrue(content.contains("video.mkv 12345678"));
  }
}
