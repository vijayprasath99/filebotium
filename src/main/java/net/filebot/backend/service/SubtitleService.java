package net.filebot.backend.service;

import java.util.List;
import net.filebot.backend.dto.SubtitleDescriptorDto;
import net.filebot.backend.dto.SubtitleDownloadRequestDto;
import net.filebot.backend.dto.SubtitleDownloadResultDto;
import net.filebot.backend.dto.SubtitleSearchRequestDto;
import net.filebot.backend.dto.SubtitleUploadRequestDto;

public interface SubtitleService {
  String computeOpenSubtitlesHash(String filePath);

  List<SubtitleDescriptorDto> searchSubtitles(SubtitleSearchRequestDto request);

  SubtitleDownloadResultDto downloadSubtitles(List<SubtitleDownloadRequestDto> requests);

  void uploadSubtitle(SubtitleUploadRequestDto request);
}
