package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;
import net.filebot.backend.domain.HashType;

public record ChecksumExportRequestDto(
    List<ChecksumEntryDto> entries, HashType hashType, String outputPath) implements Serializable {}
