package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.ChecksumStatus;
import net.filebot.backend.domain.HashType;

public record ChecksumEntryDto(
    String path,
    String expectedHash,
    String calculatedHash,
    HashType hashType,
    ChecksumStatus status)
    implements Serializable {}
