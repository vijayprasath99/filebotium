package net.filebot.backend.service;

import java.util.List;
import net.filebot.backend.dto.ChecksumEntryDto;
import net.filebot.backend.dto.ChecksumExportRequestDto;
import net.filebot.backend.dto.ChecksumVerificationRequestDto;
import net.filebot.backend.dto.ChecksumVerificationResultDto;

public interface ChecksumService {
  ChecksumVerificationResultDto startVerificationTask(ChecksumVerificationRequestDto request);

  void cancelVerificationTask(String taskId);

  List<ChecksumEntryDto> parseVerificationFile(String sfvFilePath);

  String generateVerificationFileContent(ChecksumExportRequestDto request);
}
