package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;

public record ChecksumVerificationResultDto(String taskId, List<ChecksumEntryDto> entries)
    implements Serializable {}
