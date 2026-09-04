package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.ChecksumEntryDto;
import net.filebot.backend.dto.ChecksumExportRequestDto;
import net.filebot.backend.dto.ChecksumVerificationRequestDto;
import net.filebot.backend.service.ChecksumService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sfv")
public class SfvController {

  private final ChecksumService checksumService;

  public SfvController(ChecksumService checksumService) {
    this.checksumService = checksumService;
  }

  @PostMapping("/verify")
  public String startVerificationTask(@RequestBody ChecksumVerificationRequestDto request) {
    return checksumService.startVerificationTask(request);
  }

  @PostMapping("/cancel")
  public void cancelVerificationTask(@RequestParam("taskId") String taskId) {
    checksumService.cancelVerificationTask(taskId);
  }

  @GetMapping("/parse")
  public List<ChecksumEntryDto> parseVerificationFile(
      @RequestParam("sfvFilePath") String sfvFilePath) {
    return checksumService.parseVerificationFile(sfvFilePath);
  }

  @PostMapping("/export")
  public String exportVerificationFile(@RequestBody ChecksumExportRequestDto request) {
    return checksumService.generateVerificationFileContent(request);
  }
}
