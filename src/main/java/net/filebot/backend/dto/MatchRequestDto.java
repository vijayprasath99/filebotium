package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;

public record MatchRequestDto(
    List<String> filePaths,
    ProviderType provider,
    MatchingMode mode,
    LanguageCode language,
    String formatExpression)
    implements Serializable {}
