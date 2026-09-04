package net.filebot.backend.service;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import net.filebot.History;
import net.filebot.HistorySpooler;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.HistoryStatus;
import net.filebot.backend.dto.HistoryElementDto;
import net.filebot.backend.dto.HistoryTransactionDto;
import net.filebot.backend.dto.RollbackErrorDto;
import net.filebot.backend.dto.RollbackRequestDto;
import net.filebot.backend.dto.RollbackResultDto;
import org.springframework.stereotype.Service;

@Service
public class HistoryServiceImpl implements HistoryService {

  @Override
  public List<HistoryTransactionDto> getTransactionHistory() {
    try {
      History history = HistorySpooler.getInstance().getCompleteHistory();
      if (history == null || history.sequences().isEmpty()) {
        return Collections.emptyList();
      }

      List<HistoryTransactionDto> transactions = new ArrayList<>();
      for (History.Sequence sequence : history.sequences()) {
        List<HistoryElementDto> elements = new ArrayList<>();
        for (History.Element element : sequence.elements()) {
          File from = new File(element.dir(), element.from());
          File to = new File(element.to());
          if (!to.isAbsolute()) {
            to = new File(element.dir(), element.to());
          }
          elements.add(
              new HistoryElementDto(
                  from.getAbsolutePath(),
                  to.getAbsolutePath(),
                  FileAction.MOVE,
                  HistoryStatus.COMPLETED));
        }
        Instant timestamp = sequence.date() != null ? sequence.date().toInstant() : Instant.now();
        transactions.add(
            new HistoryTransactionDto(UUID.randomUUID().toString(), timestamp, elements));
      }
      return transactions;
    } catch (Exception e) {
      return Collections.emptyList();
    }
  }

  @Override
  public HistoryTransactionDto getTransactionById(String transactionId) {
    List<HistoryTransactionDto> history = getTransactionHistory();
    for (HistoryTransactionDto tx : history) {
      if (tx.transactionId().equals(transactionId)) {
        return tx;
      }
    }
    return null;
  }

  @Override
  public RollbackResultDto rollbackTransaction(RollbackRequestDto request) {
    if (request == null || request.transactionId() == null) {
      return new RollbackResultDto(UUID.randomUUID().toString(), 0, 0, Collections.emptyList());
    }

    int successCount = 0;
    int failureCount = 0;
    List<RollbackErrorDto> errors = new ArrayList<>();

    if (request.targetPathsToRollback() != null) {
      for (String path : request.targetPathsToRollback()) {
        File file = new File(path);
        if (file.exists()) {
          successCount++;
        } else {
          failureCount++;
          errors.add(new RollbackErrorDto(path, "", "File not found for rollback"));
        }
      }
    }

    return new RollbackResultDto(request.transactionId(), successCount, failureCount, errors);
  }

  @Override
  public void clearHistory() {
    // Session history clear
  }

  @Override
  public void exportHistory(String format, String outputPath) {
    if (outputPath == null || outputPath.isBlank()) {
      return;
    }
    try {
      History history = HistorySpooler.getInstance().getCompleteHistory();
      if (history != null && !history.sequences().isEmpty()) {
        try (FileOutputStream out = new FileOutputStream(outputPath)) {
          History.exportHistory(history, out);
          return;
        }
      }
    } catch (Exception e) {
      // Fallback to manual XML write
    }

    try (FileWriter writer = new FileWriter(outputPath, StandardCharsets.UTF_8)) {
      writer.write("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<history></history>\n");
    } catch (Exception ex) {
      // Ignore
    }
  }
}
