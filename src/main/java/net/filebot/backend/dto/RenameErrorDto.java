package net.filebot.backend.dto;

import java.io.Serializable;

public record RenameErrorDto(String sourcePath, String targetPath, String errorMessage)
    implements Serializable {}
