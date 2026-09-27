package net.filebot.backend.service;

import java.util.List;
import net.filebot.backend.dto.MediaInfoInspectorDto;

public interface MediaInfoInspectorService {
  MediaInfoInspectorDto inspectFile(String filePath);

  List<MediaInfoInspectorDto> batchInspect(List<String> filePaths);
}
