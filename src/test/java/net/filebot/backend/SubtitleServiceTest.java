package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.io.FileOutputStream;
import java.util.List;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.SubtitleProviderType;
import net.filebot.backend.dto.SubtitleDescriptorDto;
import net.filebot.backend.dto.SubtitleDownloadRequestDto;
import net.filebot.backend.dto.SubtitleDownloadResultDto;
import net.filebot.backend.dto.SubtitleSearchRequestDto;
import net.filebot.backend.service.SubtitleService;
import net.filebot.backend.service.SubtitleServiceImpl;
import org.junit.jupiter.api.Test;

public class SubtitleServiceTest {

  private final SubtitleService service = new SubtitleServiceImpl();

  @Test
  public void testComputeOpenSubtitlesHash() throws Exception {
    File temp = File.createTempFile("video_hash_", ".mkv");
    temp.deleteOnExit();

    try (FileOutputStream out = new FileOutputStream(temp)) {
      out.write(new byte[128 * 1024]);
    }

    String hash = service.computeOpenSubtitlesHash(temp.getAbsolutePath());
    assertNotNull(hash);
    assertEquals(16, hash.length());
  }

  @Test
  public void testSearchAndDownloadSubtitles() throws Exception {
    // Search now genuinely queries the OpenSubtitles service (net.filebot.subtitle.
    // SubtitleUtilities.lookupSubtitlesByHash), so this is network-dependent: a bogus,
    // zero-byte temp file will not have any real hash match. We only assert the call
    // completes without throwing and returns a (possibly empty) list; if the sandbox
    // has no network access, an empty list from the caught-exception path is expected too.
    File temp = File.createTempFile("movie_", ".mp4");
    temp.deleteOnExit();

    SubtitleSearchRequestDto searchReq =
        new SubtitleSearchRequestDto(
            List.of(temp.getAbsolutePath()), LanguageCode.EN, SubtitleProviderType.OPEN_SUBTITLES);

    List<SubtitleDescriptorDto> found = service.searchSubtitles(searchReq);
    assertNotNull(found);

    SubtitleDownloadRequestDto dlReqForUnknownId =
        new SubtitleDownloadRequestDto(
            temp.getAbsolutePath(), "not-a-real-id", SubtitleProviderType.OPEN_SUBTITLES, null);
    SubtitleDownloadResultDto result = service.downloadSubtitles(List.of(dlReqForUnknownId));
    assertNotNull(result);
    assertEquals(1, result.failureCount());
  }
}
