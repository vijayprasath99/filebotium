package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.SubtitleFormat;
import net.filebot.backend.domain.SubtitleProviderType;

public record SubtitleDownloadRequestDto(
    String videoFilePath,
    String subtitleId,
    SubtitleProviderType provider,
    SubtitleFormat targetFormat)
    implements Serializable {}
