package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.MediaInfoInspectorDto;
import net.filebot.backend.service.MediaInfoInspectorService;

public class AnalyzeController {

  private final MediaInfoInspectorService inspectorService;

  public AnalyzeController(MediaInfoInspectorService inspectorService) {
    this.inspectorService = inspectorService;
  }

  public MediaInfoInspectorDto inspectFile(String filePath) {
    return inspectorService.inspectFile(filePath);
  }

  public List<MediaInfoInspectorDto> batchInspect(List<String> filePaths) {
    return inspectorService.batchInspect(filePaths);
  }
}
