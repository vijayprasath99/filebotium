package net.filebot.backend.controller;

import java.util.List;
import java.util.Map;
import net.filebot.backend.dto.ArchiveEntryDto;
import net.filebot.backend.dto.FileGroupDto;
import net.filebot.backend.dto.MediaInfoInspectorDto;
import net.filebot.backend.service.AnalyzeService;
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
  private final AnalyzeService analyzeService;

  public AnalyzeController(MediaInfoInspectorService inspectorService, AnalyzeService analyzeService) {
    this.inspectorService = inspectorService;
    this.analyzeService = analyzeService;
  }

  @GetMapping("/inspect")
  public MediaInfoInspectorDto inspectFile(@RequestParam("path") String filePath) {
    return inspectorService.inspectFile(filePath);
  }

  @PostMapping("/batch-inspect")
  public List<MediaInfoInspectorDto> batchInspect(@RequestBody List<String> filePaths) {
    return inspectorService.batchInspect(filePaths);
  }

  @GetMapping("/archive/entries")
  public List<ArchiveEntryDto> listArchiveEntries(@RequestParam("path") String archiveFilePath) {
    return analyzeService.listArchiveEntries(archiveFilePath);
  }

  @PostMapping("/parts")
  public List<FileGroupDto> groupIntoParts(
      @RequestBody List<String> filePaths, @RequestParam(value = "splitSizeMB", defaultValue = "4480") long splitSizeMB) {
    return analyzeService.groupIntoParts(filePaths, splitSizeMB);
  }

  @PostMapping("/types")
  public List<FileGroupDto> classifyByType(@RequestBody List<String> filePaths) {
    return analyzeService.classifyByType(filePaths);
  }

  @GetMapping("/attributes")
  public Map<String, String> getFileAttributes(@RequestParam("path") String filePath) {
    return analyzeService.getFileAttributes(filePath);
  }
}
