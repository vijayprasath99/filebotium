package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;
import net.filebot.backend.domain.WorkspaceTab;

public record IntakeRequestDto(
    List<String> paths, boolean recursive, boolean filterHidden, WorkspaceTab targetWorkspace)
    implements Serializable {}
