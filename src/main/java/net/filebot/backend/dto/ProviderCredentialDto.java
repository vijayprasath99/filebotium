package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.ProviderType;

public record ProviderCredentialDto(
    ProviderType provider, String apiKey, String username, String password)
    implements Serializable {}
