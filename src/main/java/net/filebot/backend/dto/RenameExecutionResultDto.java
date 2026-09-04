package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;

public record RenameExecutionResultDto(
    String transactionId, int successCount, int failureCount, List<RenameErrorDto> errors)
    implements Serializable {}
