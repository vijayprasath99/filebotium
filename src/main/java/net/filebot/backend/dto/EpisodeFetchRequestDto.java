package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.EpisodeSortOrder;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;

public record EpisodeFetchRequestDto(
    int seriesId,
    ProviderType provider,
    EpisodeSortOrder sortOrder,
    LanguageCode language,
    Integer seasonFilter)
    implements Serializable {}
