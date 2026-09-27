package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;

public record PresetDto(
    String name,
    String formatExpression,
    ProviderType provider,
    MatchingMode mode,
    LanguageCode language,
    FileAction action)
    implements Serializable {}
