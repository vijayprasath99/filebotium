package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.LanguageCode;

public record SubtitleUploadRequestDto(
    String videoFilePath, String subtitleFilePath, LanguageCode language, String imdbId)
    implements Serializable {}
