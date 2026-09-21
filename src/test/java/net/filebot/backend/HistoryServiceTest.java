package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import net.filebot.backend.dto.HistoryTransactionDto;
import net.filebot.backend.dto.RollbackRequestDto;
import net.filebot.backend.dto.RollbackResultDto;
import net.filebot.backend.service.HistoryService;
import net.filebot.backend.service.HistoryServiceImpl;
import org.junit.jupiter.api.Test;

public class HistoryServiceTest {

  private final HistoryService service = new HistoryServiceImpl();

  @Test
  public void testGetTransactionHistory() {
    List<HistoryTransactionDto> history = service.getTransactionHistory();
    assertNotNull(history);
  }

  @Test
  public void testRollbackTransactionWithMissingFile() {
    RollbackRequestDto req = new RollbackRequestDto("tx-123", List.of("/non/existent/target.mkv"));
    RollbackResultDto result = service.rollbackTransaction(req);
    assertNotNull(result);
    assertEquals(1, result.failureCount());
  }

  @Test
  public void testExportHistory() {
    byte[] content = service.exportHistory("xml");
    assertNotNull(content);
  }
}
