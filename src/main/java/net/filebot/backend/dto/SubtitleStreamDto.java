package net.filebot.backend.dto;

import java.io.Serializable;

public record SubtitleStreamDto(
    int streamIndex, String format, String language, boolean isDefault, boolean isForced)
    implements Serializable {}
