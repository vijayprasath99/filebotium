package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;

public record RollbackRequestDto(String transactionId, List<String> targetPathsToRollback)
    implements Serializable {}
