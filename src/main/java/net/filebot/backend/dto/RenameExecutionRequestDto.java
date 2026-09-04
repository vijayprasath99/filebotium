package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;
import net.filebot.backend.domain.ConflictStrategy;
import net.filebot.backend.domain.FileAction;

public record RenameExecutionRequestDto(
    List<MatchDto> matches, FileAction action, ConflictStrategy conflictStrategy)
    implements Serializable {}
