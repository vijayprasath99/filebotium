package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import net.filebot.backend.dto.MediaInfoInspectorDto;
import net.filebot.backend.service.MediaInfoInspectorService;
import net.filebot.backend.service.MediaInfoInspectorServiceImpl;
import org.junit.jupiter.api.Test;

public class MediaInfoInspectorServiceTest {

  private final MediaInfoInspectorService service = new MediaInfoInspectorServiceImpl();

  @Test
  public void testInspectNonExistentFile() {
    MediaInfoInspectorDto dto = service.inspectFile("/non/existent/file.mkv");
    assertNotNull(dto);
    assertEquals("/non/existent/file.mkv", dto.filePath());
    assertEquals("UNKNOWN", dto.containerFormat());
  }

  @Test
  public void testBatchInspectEmptyList() {
    List<MediaInfoInspectorDto> dtos = service.batchInspect(List.of());
    assertNotNull(dtos);
    assertTrue(dtos.isEmpty());
  }
}
