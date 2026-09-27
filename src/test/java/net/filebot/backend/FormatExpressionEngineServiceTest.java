package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import net.filebot.backend.dto.BindingDocumentationDto;
import net.filebot.backend.dto.FormatEvaluationResultDto;
import net.filebot.backend.service.FormatExpressionEngineService;
import net.filebot.backend.service.FormatExpressionEngineServiceImpl;
import net.filebot.web.Episode;
import net.filebot.web.SeriesInfo;
import net.filebot.web.SimpleDate;
import org.junit.jupiter.api.Test;

public class FormatExpressionEngineServiceTest {

  private final FormatExpressionEngineService service = new FormatExpressionEngineServiceImpl();

  @Test
  public void testEvaluateExpression() {
    SeriesInfo seriesInfo = new SeriesInfo();
    seriesInfo.setStartDate(new SimpleDate(2005, 3, 24));
    Episode episode =
        new Episode(
            "The Office", 1, 1, "Pilot", 1, null, new SimpleDate(2005, 3, 24), 101, seriesInfo);

    FormatEvaluationResultDto result =
        service.evaluateExpression("{n} ({y}) - {t}", episode, "The.Office.S01E01.mkv");

    assertNotNull(result);
    assertFalse(result.isError());
    assertEquals("The Office (2005) - Pilot", result.result());
  }

  @Test
  public void testValidateExpressionSyntax() {
    assertTrue(service.validateExpressionSyntax("{n} - {t}"));
    assertFalse(service.validateExpressionSyntax(null));
  }

  @Test
  public void testGetAvailableBindings() {
    List<BindingDocumentationDto> bindings = service.getAvailableBindings("sample.mkv", null);
    assertNotNull(bindings);
    assertFalse(bindings.isEmpty());
  }
}
