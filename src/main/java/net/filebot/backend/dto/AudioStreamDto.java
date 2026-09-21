package net.filebot.backend.dto;

import java.io.Serializable;

public record AudioStreamDto(
    int streamIndex, String codec, int channels, int samplingRateHz, String language, long bitrate)
    implements Serializable {}
