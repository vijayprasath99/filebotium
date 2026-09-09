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
import net.filebot.backend.service.ChecksumService;
import net.filebot.backend.service.ChecksumServiceImpl;
import org.junit.jupiter.api.Test;

public class ChecksumServiceTest {

  private final ChecksumService service = new ChecksumServiceImpl();

  @Test
  public void testStartVerificationTask() {
    ChecksumVerificationRequestDto req =
        new ChecksumVerificationRequestDto(List.of("file1.mkv"), HashType.CRC32, null);
    String taskId = service.startVerificationTask(req);
    assertNotNull(taskId);
    assertFalse(taskId.isEmpty());
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
