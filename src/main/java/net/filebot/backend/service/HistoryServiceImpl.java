package net.filebot.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import net.filebot.History;
import net.filebot.HistorySpooler;
import net.filebot.StandardRenameAction;
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
        transactions.add(
            new HistoryTransactionDto(transactionId(sequence), timestamp(sequence), elements));
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
      return new RollbackResultDto("", 0, 0, Collections.emptyList());
    }

    int successCount = 0;
    int failureCount = 0;
    List<RollbackErrorDto> errors = new ArrayList<>();

    try {
      History history = HistorySpooler.getInstance().getCompleteHistory();
      History.Sequence sequence = findSequence(history, request.transactionId());

      if (sequence == null) {
        List<String> requestedTargets =
            request.targetPathsToRollback() != null && !request.targetPathsToRollback().isEmpty()
                ? request.targetPathsToRollback()
                : List.of("");
        List<RollbackErrorDto> notFoundErrors =
            requestedTargets.stream()
                .map(path -> new RollbackErrorDto(path, "", "Transaction not found"))
                .toList();
        return new RollbackResultDto(
            request.transactionId(), 0, notFoundErrors.size(), notFoundErrors);
      }

      // to (current path on disk) -> from (original path before the rename)
      Map<File, File> targetToOriginal = new HashMap<>();
      for (History.Element element : sequence.elements()) {
        File from = new File(element.dir(), element.from());
        File to = new File(element.to());
        if (!to.isAbsolute()) {
          to = new File(element.dir(), element.to());
        }
        targetToOriginal.put(to, from);
      }

      List<File> targets =
          request.targetPathsToRollback() != null && !request.targetPathsToRollback().isEmpty()
              ? request.targetPathsToRollback().stream().map(File::new).toList()
              : new ArrayList<>(targetToOriginal.keySet());

      for (File target : targets) {
        File original = targetToOriginal.get(target);
        if (original == null) {
          failureCount++;
          errors.add(
              new RollbackErrorDto(
                  target.getPath(), "", "No matching history entry for this path"));
          continue;
        }

        try {
          StandardRenameAction.revert(target, original);
          successCount++;
        } catch (Exception e) {
          failureCount++;
          errors.add(new RollbackErrorDto(target.getPath(), original.getPath(), e.getMessage()));
        }
      }
    } catch (Exception e) {
      return new RollbackResultDto(
          request.transactionId(),
          0,
          0,
          List.of(new RollbackErrorDto("", "", "Failed to read history: " + e.getMessage())));
    }

    return new RollbackResultDto(request.transactionId(), successCount, failureCount, errors);
  }

  @Override
  public void clearHistory() {
    // No confirmed legacy precedent for a user-facing "clear history" action
    // (see specs/audit/08_history_and_list_audit.md Gap 4) - left as a no-op
    // pending an explicit product decision, rather than silently deleting
    // ~/.filebot/history.xml.
  }

  @Override
  public byte[] exportHistory(String format) {
    try {
      History history = HistorySpooler.getInstance().getCompleteHistory();
      if (history == null || history.sequences().isEmpty()) {
        return new byte[0];
      }
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      History.exportHistory(history, out);
      return out.toByteArray();
    } catch (Exception e) {
      return new byte[0];
    }
  }

  private History.Sequence findSequence(History history, String transactionId) {
    if (history == null) {
      return null;
    }
    for (History.Sequence sequence : history.sequences()) {
      if (transactionId(sequence).equals(transactionId)) {
        return sequence;
      }
    }
    return null;
  }

  private String transactionId(History.Sequence sequence) {
    return sequence.date() != null ? String.valueOf(sequence.date().getTime()) : "unknown";
  }

  private Instant timestamp(History.Sequence sequence) {
    return sequence.date() != null ? sequence.date().toInstant() : Instant.now();
  }
}
