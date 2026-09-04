package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.HistoryTransactionDto;
import net.filebot.backend.dto.RollbackRequestDto;
import net.filebot.backend.dto.RollbackResultDto;
import net.filebot.backend.service.HistoryService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/history")
public class HistoryController {

  private final HistoryService historyService;

  public HistoryController(HistoryService historyService) {
    this.historyService = historyService;
  }

  @GetMapping
  public List<HistoryTransactionDto> getTransactionHistory() {
    return historyService.getTransactionHistory();
  }

  @GetMapping("/{id}")
  public HistoryTransactionDto getTransactionById(@PathVariable("id") String transactionId) {
    return historyService.getTransactionById(transactionId);
  }

  @PostMapping("/rollback")
  public RollbackResultDto rollbackTransaction(@RequestBody RollbackRequestDto request) {
    return historyService.rollbackTransaction(request);
  }

  @DeleteMapping
  public void clearHistory() {
    historyService.clearHistory();
  }

  @PostMapping("/export")
  public void exportHistory(
      @RequestParam(value = "format", defaultValue = "xml") String format,
      @RequestParam("outputPath") String outputPath) {
    historyService.exportHistory(format, outputPath);
  }
}
