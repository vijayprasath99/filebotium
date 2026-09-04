package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;
import net.filebot.backend.domain.HashType;

public record ChecksumVerificationRequestDto(
    List<String> filePaths, HashType hashType, String sfvFilePath) implements Serializable {}
