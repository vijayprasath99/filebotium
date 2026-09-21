package net.filebot.backend.dto;

import java.io.Serializable;
import java.time.LocalDate;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;

public record EpisodeDto(
    ProviderType provider,
    String seriesName,
    Integer seriesId,
    Integer seasonNumber,
    Integer episodeNumber,
    Integer absoluteNumber,
    String title,
    LocalDate releaseDate,
    LanguageCode language,
    String overview)
    implements Serializable {}
