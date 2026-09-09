package net.filebot.backend.service;

import java.util.List;
import net.filebot.backend.dto.HistoryTransactionDto;
import net.filebot.backend.dto.RollbackRequestDto;
import net.filebot.backend.dto.RollbackResultDto;

public interface HistoryService {
  List<HistoryTransactionDto> getTransactionHistory();

  HistoryTransactionDto getTransactionById(String transactionId);

  RollbackResultDto rollbackTransaction(RollbackRequestDto request);

  void clearHistory();

  void exportHistory(String format, String outputPath);
}
