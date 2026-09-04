package net.filebot.backend.dto;

import java.io.Serializable;

public record VideoStreamDto(
    int streamIndex,
    String codec,
    int width,
    int height,
    double frameRate,
    int bitDepth,
    String hdrFormat)
    implements Serializable {}
