package net.filebot.backend.dto;

import java.io.Serializable;

public record ArchiveEntryDto(String name, String path, long size) implements Serializable {}
