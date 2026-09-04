package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.BindingDocumentationDto;
import net.filebot.backend.dto.FormatEvaluationRequestDto;
import net.filebot.backend.dto.FormatEvaluationResultDto;
import net.filebot.backend.service.FormatExpressionEngineService;

public class FormatController {

  private final FormatExpressionEngineService formatService;

  public FormatController(FormatExpressionEngineService formatService) {
    this.formatService = formatService;
  }

  public FormatEvaluationResultDto evaluateExpression(FormatEvaluationRequestDto request) {
    if (request == null) {
      return new FormatEvaluationResultDto("", "", false, null, 0);
    }
    return formatService.evaluateExpression(
        request.expression(), request.sampleMetadata(), request.sampleFilePath());
  }

  public List<BindingDocumentationDto> getAvailableBindings(String filePath) {
    return formatService.getAvailableBindings(filePath, null);
  }

  public boolean validateExpression(String expression) {
    return formatService.validateExpressionSyntax(expression);
  }
}
