package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.MatchStatus;

public record MatchDto(
    String matchId,
    MediaFileDto sourceFile,
    Object targetMetadata,
    double score,
    String formattedName,
    String formattedPath,
    boolean isExcluded,
    MatchStatus status)
    implements Serializable {}
