package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;

public record MediaInfoInspectorDto(
    String filePath,
    String containerFormat,
    long durationMs,
    long totalBitrate,
    List<VideoStreamDto> videoStreams,
    List<AudioStreamDto> audioStreams,
    List<SubtitleStreamDto> subtitleStreams)
    implements Serializable {}
