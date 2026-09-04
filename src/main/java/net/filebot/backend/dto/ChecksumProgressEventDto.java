package net.filebot.backend.dto;

import java.io.Serializable;

public record ChecksumProgressEventDto(
    String taskId,
    String currentFilePath,
    long bytesProcessed,
    long totalBytes,
    double MBps,
    double progressPercentage,
    ChecksumEntryDto completedEntry)
    implements Serializable {}
