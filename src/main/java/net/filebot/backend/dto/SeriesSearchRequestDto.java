package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;

public record SeriesSearchRequestDto(String query, ProviderType provider, LanguageCode language)
    implements Serializable {}
