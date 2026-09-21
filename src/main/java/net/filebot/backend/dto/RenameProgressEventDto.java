package net.filebot.backend.dto;

import java.io.Serializable;

public record RenameProgressEventDto(
    String taskId, int processed, int total, String currentFile, double progressPercentage)
    implements Serializable {}
