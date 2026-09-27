package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.SubtitleFormat;
import net.filebot.backend.domain.SubtitleNamingStrategy;
import net.filebot.backend.domain.SubtitleProviderType;

public record SubtitleDownloadRequestDto(
    String videoFilePath,
    String subtitleId,
    SubtitleProviderType provider,
    SubtitleFormat targetFormat,
    SubtitleNamingStrategy namingStrategy)
    implements Serializable {

  public SubtitleDownloadRequestDto(
      String videoFilePath,
      String subtitleId,
      SubtitleProviderType provider,
      SubtitleFormat targetFormat) {
    this(videoFilePath, subtitleId, provider, targetFormat, SubtitleNamingStrategy.MATCH_VIDEO_ADD_LANGUAGE_TAG);
  }
}
