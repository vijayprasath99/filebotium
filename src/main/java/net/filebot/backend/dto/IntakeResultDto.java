package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;

public record IntakeResultDto(List<MediaFileDto> acceptedFiles, int rejectedCount)
    implements Serializable {}
