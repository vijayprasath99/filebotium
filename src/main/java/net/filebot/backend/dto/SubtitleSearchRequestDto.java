package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.SubtitleProviderType;
import net.filebot.backend.domain.SubtitleSearchStrategy;

public record SubtitleSearchRequestDto(
    List<String> videoFilePaths,
    LanguageCode language,
    SubtitleProviderType provider,
    SubtitleSearchStrategy strategy)
    implements Serializable {

  public SubtitleSearchRequestDto(
      List<String> videoFilePaths, LanguageCode language, SubtitleProviderType provider) {
    this(videoFilePaths, language, provider, SubtitleSearchStrategy.EXACT);
  }
}
