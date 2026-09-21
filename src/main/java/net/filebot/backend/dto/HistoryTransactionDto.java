package net.filebot.backend.dto;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;

public record HistoryTransactionDto(
    String transactionId, Instant timestamp, List<HistoryElementDto> elements)
    implements Serializable {}
