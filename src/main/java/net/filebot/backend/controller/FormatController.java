package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.BindingDocumentationDto;
import net.filebot.backend.dto.FormatEvaluationRequestDto;
import net.filebot.backend.dto.FormatEvaluationResultDto;
import net.filebot.backend.service.FormatExpressionEngineService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/format")
public class FormatController {

  private final FormatExpressionEngineService formatService;

  public FormatController(FormatExpressionEngineService formatService) {
    this.formatService = formatService;
  }

  @PostMapping("/eval")
  public FormatEvaluationResultDto evaluateExpression(
      @RequestBody FormatEvaluationRequestDto request) {
    if (request == null) {
      return new FormatEvaluationResultDto("", "", false, null, 0);
    }
    return formatService.evaluateExpression(
        request.expression(), request.sampleMetadata(), request.sampleFilePath());
  }

  @GetMapping("/bindings")
  public List<BindingDocumentationDto> getAvailableBindings(
      @RequestParam(value = "filePath", required = false) String filePath) {
    return formatService.getAvailableBindings(filePath, null);
  }

  @PostMapping("/validate")
  public boolean validateExpression(@RequestParam("expression") String expression) {
    return formatService.validateExpressionSyntax(expression);
  }
}
