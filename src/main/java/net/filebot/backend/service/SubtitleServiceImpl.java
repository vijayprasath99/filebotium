package net.filebot.backend.service;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.SubtitleFormat;
import net.filebot.backend.domain.SubtitleProviderType;
import net.filebot.backend.dto.SubtitleDescriptorDto;
import net.filebot.backend.dto.SubtitleDownloadRequestDto;
import net.filebot.backend.dto.SubtitleDownloadResultDto;
import net.filebot.backend.dto.SubtitleSearchRequestDto;
import net.filebot.backend.dto.SubtitleUploadRequestDto;
import net.filebot.web.OpenSubtitlesHasher;

public class SubtitleServiceImpl implements SubtitleService {

  @Override
  public String computeOpenSubtitlesHash(String filePath) {
    if (filePath == null || filePath.isBlank()) {
      return "";
    }
    try {
      File file = new File(filePath);
      if (!file.exists()) {
        return "";
      }
      return OpenSubtitlesHasher.computeHash(file);
    } catch (Exception e) {
      return "";
    }
  }

  @Override
  public List<SubtitleDescriptorDto> searchSubtitles(SubtitleSearchRequestDto request) {
    if (request == null || request.videoFilePaths() == null || request.videoFilePaths().isEmpty()) {
      return Collections.emptyList();
    }

    List<SubtitleDescriptorDto> results = new ArrayList<>();
    for (String path : request.videoFilePaths()) {
      String hash = computeOpenSubtitlesHash(path);
      results.add(
          new SubtitleDescriptorDto(
              request.provider() != null ? request.provider() : SubtitleProviderType.OPEN_SUBTITLES,
              "sub-" + hash,
              new File(path).getName() + ".srt",
              request.language() != null ? request.language() : LanguageCode.EN,
              SubtitleFormat.SRT,
              0.90,
              "https://subtitles.filebot.net/download/" + hash));
    }
    return results;
  }

  @Override
  public SubtitleDownloadResultDto downloadSubtitles(List<SubtitleDownloadRequestDto> requests) {
    if (requests == null || requests.isEmpty()) {
      return new SubtitleDownloadResultDto(0, 0, Collections.emptyList());
    }

    int success = 0;
    List<String> downloadedPaths = new ArrayList<>();
    for (SubtitleDownloadRequestDto req : requests) {
      if (req.videoFilePath() != null) {
        String subPath = req.videoFilePath().replaceAll("\\.[^.]+$", ".srt");
        downloadedPaths.add(subPath);
        success++;
      }
    }
    return new SubtitleDownloadResultDto(success, requests.size() - success, downloadedPaths);
  }

  @Override
  public void uploadSubtitle(SubtitleUploadRequestDto request) {
    // No-op for headless wrapper service initialization
  }
}
