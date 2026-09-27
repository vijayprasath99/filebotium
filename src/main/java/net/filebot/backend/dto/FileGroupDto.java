package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;

public record FileGroupDto(String name, List<String> files, long totalSizeBytes)
    implements Serializable {}
