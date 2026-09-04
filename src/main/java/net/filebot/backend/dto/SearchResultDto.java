package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.ProviderType;

public record SearchResultDto(int id, String name, Integer year, ProviderType provider)
    implements Serializable {}
