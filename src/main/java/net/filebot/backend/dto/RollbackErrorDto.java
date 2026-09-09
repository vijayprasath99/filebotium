package net.filebot.backend.dto;

import java.io.Serializable;

public record RollbackErrorDto(String targetPath, String expectedSourcePath, String errorMessage)
    implements Serializable {}
