package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.HistoryTransactionDto;
import net.filebot.backend.dto.RollbackRequestDto;
import net.filebot.backend.dto.RollbackResultDto;
import net.filebot.backend.service.HistoryService;

public class HistoryController {

  private final HistoryService historyService;

  public HistoryController(HistoryService historyService) {
    this.historyService = historyService;
  }

  public List<HistoryTransactionDto> getTransactionHistory() {
    return historyService.getTransactionHistory();
  }

  public HistoryTransactionDto getTransactionById(String transactionId) {
    return historyService.getTransactionById(transactionId);
  }

  public RollbackResultDto rollbackTransaction(RollbackRequestDto request) {
    return historyService.rollbackTransaction(request);
  }

  public void clearHistory() {
    historyService.clearHistory();
  }

  public void exportHistory(String format, String outputPath) {
    historyService.exportHistory(format, outputPath);
  }
}
