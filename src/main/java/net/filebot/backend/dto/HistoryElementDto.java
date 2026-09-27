package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.HistoryStatus;

public record HistoryElementDto(
    String sourcePath, String targetPath, FileAction action, HistoryStatus status)
    implements Serializable {}
