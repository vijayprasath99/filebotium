package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.SubtitleProviderType;

public record SubtitleSearchRequestDto(
    List<String> videoFilePaths, LanguageCode language, SubtitleProviderType provider)
    implements Serializable {}
