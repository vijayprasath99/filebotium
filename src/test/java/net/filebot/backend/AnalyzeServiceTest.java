package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.io.FileOutputStream;
import java.util.List;
import net.filebot.backend.dto.FileGroupDto;
import net.filebot.backend.service.AnalyzeService;
import net.filebot.backend.service.AnalyzeServiceImpl;
import org.junit.jupiter.api.Test;

public class AnalyzeServiceTest {

  private final AnalyzeService service = new AnalyzeServiceImpl();

  @Test
  public void testClassifyByTypeGroupsVideoFiles() throws Exception {
    File video = File.createTempFile("movie_", ".mkv");
    video.deleteOnExit();

    List<FileGroupDto> groups = service.classifyByType(List.of(video.getAbsolutePath()));
    assertNotNull(groups);
    assertTrue(groups.stream().anyMatch(g -> g.name().equals("Video")));
  }

  @Test
  public void testGroupIntoPartsSplitsBySize() throws Exception {
    File small = File.createTempFile("part_", ".bin");
    small.deleteOnExit();
    try (FileOutputStream out = new FileOutputStream(small)) {
      out.write(new byte[1024]);
    }

    // splitSizeMB=0 will fall back to the default (4480MB) - well above our 1KB test file,
    // so everything lands in a single "Disk 1" group.
    List<FileGroupDto> groups = service.groupIntoParts(List.of(small.getAbsolutePath()), 0);
    assertEquals(1, groups.size());
    assertEquals("Disk 1", groups.get(0).name());
    assertEquals(1024, groups.get(0).totalSizeBytes());
  }

  @Test
  public void testGetFileAttributesForMissingFileReturnsEmpty() {
    assertTrue(service.getFileAttributes("/does/not/exist.mkv").isEmpty());
  }

  @Test
  public void testListArchiveEntriesForNonArchiveReturnsEmpty() throws Exception {
    File notAnArchive = File.createTempFile("plain_", ".txt");
    notAnArchive.deleteOnExit();
    assertTrue(service.listArchiveEntries(notAnArchive.getAbsolutePath()).isEmpty());
  }
}
