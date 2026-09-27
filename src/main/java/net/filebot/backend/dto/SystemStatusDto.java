package net.filebot.backend.dto;

import java.io.Serializable;

public record SystemStatusDto(
    String appName,
    String version,
    String javaVersion,
    String osName,
    String osArch,
    long freeMemoryBytes,
    long totalMemoryBytes)
    implements Serializable {}
