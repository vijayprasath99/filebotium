package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;

public record MovieDto(
    ProviderType provider,
    String title,
    Integer year,
    Integer tmdbId,
    String imdbId,
    LanguageCode language,
    String overview)
    implements Serializable {}
