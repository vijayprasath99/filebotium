package net.filebot.backend.service;

import java.util.List;
import net.filebot.backend.dto.BindingDocumentationDto;
import net.filebot.backend.dto.FormatEvaluationResultDto;

public interface FormatExpressionEngineService {
  FormatEvaluationResultDto evaluateExpression(
      String expression, Object metadataContext, String filePath);

  List<FormatEvaluationResultDto> batchEvaluate(String expression, List<String> filePaths);

  List<BindingDocumentationDto> getAvailableBindings(String filePath, Object metadataContext);

  boolean validateExpressionSyntax(String expression);
}
