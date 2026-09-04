package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.MediaInfoInspectorDto;
import net.filebot.backend.service.MediaInfoInspectorService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analyze")
public class AnalyzeController {

  private final MediaInfoInspectorService inspectorService;

  public AnalyzeController(MediaInfoInspectorService inspectorService) {
    this.inspectorService = inspectorService;
  }

  @GetMapping("/inspect")
  public MediaInfoInspectorDto inspectFile(@RequestParam("path") String filePath) {
    return inspectorService.inspectFile(filePath);
  }

  @PostMapping("/batch-inspect")
  public List<MediaInfoInspectorDto> batchInspect(@RequestBody List<String> filePaths) {
    return inspectorService.batchInspect(filePaths);
  }
}
