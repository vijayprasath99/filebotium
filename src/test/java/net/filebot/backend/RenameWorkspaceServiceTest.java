package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.io.FileWriter;
import java.util.List;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.backend.dto.RenameExecutionRequestDto;
import net.filebot.backend.dto.RenameExecutionResultDto;
import net.filebot.backend.service.RenameWorkspaceService;
import net.filebot.backend.service.RenameWorkspaceServiceImpl;
import org.junit.jupiter.api.Test;

public class RenameWorkspaceServiceTest {

  private final RenameWorkspaceService service = new RenameWorkspaceServiceImpl();

  @Test
  public void testAutoMatchAndApplyFormat() throws Exception {
    File tempFile = File.createTempFile("The.Office.S01E01.", ".mkv");
    tempFile.deleteOnExit();

    MatchRequestDto request =
        new MatchRequestDto(
            List.of(tempFile.getAbsolutePath()),
            ProviderType.THE_TVDB,
            MatchingMode.TV,
            null,
            "{fn}.renamed");

    List<MatchDto> matches = service.autoMatch(request);
    assertNotNull(matches);
    assertEquals(1, matches.size());
    assertTrue(matches.get(0).formattedName().contains("renamed"));
  }

  @Test
  public void testExecuteRenameCopy() throws Exception {
    File tempSource = File.createTempFile("source_video_", ".mp4");
    tempSource.deleteOnExit();
    try (FileWriter fw = new FileWriter(tempSource)) {
      fw.write("sample content");
    }

    MatchRequestDto request =
        new MatchRequestDto(
            List.of(tempSource.getAbsolutePath()),
            ProviderType.THE_TVDB,
            MatchingMode.TV,
            null,
            null);

    List<MatchDto> matches = service.autoMatch(request);
    RenameExecutionRequestDto renameReq =
        new RenameExecutionRequestDto(matches, FileAction.COPY, null);

    RenameExecutionResultDto result = service.executeRename(renameReq);
    assertNotNull(result);
    assertEquals(1, result.successCount());
  }
}
