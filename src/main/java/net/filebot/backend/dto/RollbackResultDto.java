package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;

public record RollbackResultDto(
    String transactionId, int successCount, int failureCount, List<RollbackErrorDto> errors)
    implements Serializable {}
