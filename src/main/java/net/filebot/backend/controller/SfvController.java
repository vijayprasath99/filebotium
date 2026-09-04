package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.ChecksumEntryDto;
import net.filebot.backend.dto.ChecksumExportRequestDto;
import net.filebot.backend.dto.ChecksumVerificationRequestDto;
import net.filebot.backend.service.ChecksumService;

public class SfvController {

  private final ChecksumService checksumService;

  public SfvController(ChecksumService checksumService) {
    this.checksumService = checksumService;
  }

  public String startVerificationTask(ChecksumVerificationRequestDto request) {
    return checksumService.startVerificationTask(request);
  }

  public void cancelVerificationTask(String taskId) {
    checksumService.cancelVerificationTask(taskId);
  }

  public List<ChecksumEntryDto> parseVerificationFile(String sfvFilePath) {
    return checksumService.parseVerificationFile(sfvFilePath);
  }

  public String exportVerificationFile(ChecksumExportRequestDto request) {
    return checksumService.generateVerificationFileContent(request);
  }
}
