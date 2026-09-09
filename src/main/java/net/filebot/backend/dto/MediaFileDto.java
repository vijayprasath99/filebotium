package net.filebot.backend.dto;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;

public record MediaFileDto(
    String id,
    String path,
    String name,
    String extension,
    long size,
    Instant lastModified,
    String parentPath,
    boolean isDirectory,
    String checksum,
    Map<String, String> xattrs)
    implements Serializable {}
