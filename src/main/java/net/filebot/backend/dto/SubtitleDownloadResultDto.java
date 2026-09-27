package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;

public record SubtitleDownloadResultDto(
    int successCount, int failureCount, List<String> downloadedSubtitlePaths)
    implements Serializable {}
