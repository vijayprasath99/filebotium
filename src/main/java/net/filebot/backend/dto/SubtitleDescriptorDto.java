package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.SubtitleFormat;
import net.filebot.backend.domain.SubtitleProviderType;

public record SubtitleDescriptorDto(
    SubtitleProviderType provider,
    String id,
    String name,
    LanguageCode language,
    SubtitleFormat format,
    double score,
    String downloadUrl)
    implements Serializable {}
