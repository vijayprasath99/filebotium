package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.SubtitleDescriptorDto;
import net.filebot.backend.dto.SubtitleDownloadRequestDto;
import net.filebot.backend.dto.SubtitleDownloadResultDto;
import net.filebot.backend.dto.SubtitleSearchRequestDto;
import net.filebot.backend.dto.SubtitleUploadRequestDto;
import net.filebot.backend.service.SubtitleService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/subtitles")
public class SubtitleController {

  private final SubtitleService subtitleService;

  public SubtitleController(SubtitleService subtitleService) {
    this.subtitleService = subtitleService;
  }

  @GetMapping("/hash")
  public String computeHash(@RequestParam("filePath") String filePath) {
    return subtitleService.computeOpenSubtitlesHash(filePath);
  }

  @PostMapping("/search")
  public List<SubtitleDescriptorDto> searchSubtitles(
      @RequestBody SubtitleSearchRequestDto request) {
    return subtitleService.searchSubtitles(request);
  }

  @PostMapping("/download")
  public SubtitleDownloadResultDto downloadSubtitles(
      @RequestBody List<SubtitleDownloadRequestDto> requests) {
    return subtitleService.downloadSubtitles(requests);
  }

  @PostMapping("/upload")
  public void uploadSubtitle(@RequestBody SubtitleUploadRequestDto request) {
    subtitleService.uploadSubtitle(request);
  }
}
