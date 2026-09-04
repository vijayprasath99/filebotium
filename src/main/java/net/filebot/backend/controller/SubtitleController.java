package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.SubtitleDescriptorDto;
import net.filebot.backend.dto.SubtitleDownloadRequestDto;
import net.filebot.backend.dto.SubtitleDownloadResultDto;
import net.filebot.backend.dto.SubtitleSearchRequestDto;
import net.filebot.backend.dto.SubtitleUploadRequestDto;
import net.filebot.backend.service.SubtitleService;

public class SubtitleController {

  private final SubtitleService subtitleService;

  public SubtitleController(SubtitleService subtitleService) {
    this.subtitleService = subtitleService;
  }

  public String computeHash(String filePath) {
    return subtitleService.computeOpenSubtitlesHash(filePath);
  }

  public List<SubtitleDescriptorDto> searchSubtitles(SubtitleSearchRequestDto request) {
    return subtitleService.searchSubtitles(request);
  }

  public SubtitleDownloadResultDto downloadSubtitles(List<SubtitleDownloadRequestDto> requests) {
    return subtitleService.downloadSubtitles(requests);
  }

  public void uploadSubtitle(SubtitleUploadRequestDto request) {
    subtitleService.uploadSubtitle(request);
  }
}
