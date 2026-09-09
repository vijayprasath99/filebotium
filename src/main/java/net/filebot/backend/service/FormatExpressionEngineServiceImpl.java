package net.filebot.backend.service;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import net.filebot.backend.domain.BindingCategory;
import net.filebot.backend.dto.BindingDocumentationDto;
import net.filebot.backend.dto.FormatEvaluationResultDto;
import net.filebot.format.ExpressionFormat;
import net.filebot.format.MediaBindingBean;
import org.springframework.stereotype.Service;

@Service
public class FormatExpressionEngineServiceImpl implements FormatExpressionEngineService {

  @Override
  public FormatEvaluationResultDto evaluateExpression(
      String expression, Object metadataContext, String filePath) {
    if (expression == null || expression.isBlank()) {
      return new FormatEvaluationResultDto(expression, "", false, null, 0);
    }

    long start = System.currentTimeMillis();
    try {
      ExpressionFormat format = new ExpressionFormat(expression);
      File file = filePath != null ? new File(filePath) : null;
      MediaBindingBean bindingBean = new MediaBindingBean(metadataContext, file, null);
      Object result = format.format(bindingBean);
      long elapsed = System.currentTimeMillis() - start;
      return new FormatEvaluationResultDto(
          expression, result != null ? result.toString() : "", false, null, elapsed);
    } catch (Exception e) {
      long elapsed = System.currentTimeMillis() - start;
      return new FormatEvaluationResultDto(expression, "", true, e.getMessage(), elapsed);
    }
  }

  @Override
  public List<FormatEvaluationResultDto> batchEvaluate(String expression, List<String> filePaths) {
    if (filePaths == null) {
      return List.of();
    }

    List<FormatEvaluationResultDto> results = new ArrayList<>();
    for (String path : filePaths) {
      results.add(evaluateExpression(expression, new File(path), path));
    }
    return results;
  }

  @Override
  public List<BindingDocumentationDto> getAvailableBindings(
      String filePath, Object metadataContext) {
    List<BindingDocumentationDto> bindings = new ArrayList<>();
    bindings.add(
        new BindingDocumentationDto(
            "n", "Name / Series Title / Movie Title", "The Office", BindingCategory.GENERAL));
    bindings.add(
        new BindingDocumentationDto(
            "s00e00", "Season and Episode (S01E05)", "S01E05", BindingCategory.SERIES));
    bindings.add(
        new BindingDocumentationDto(
            "t", "Episode / Track Title", "Pilot", BindingCategory.GENERAL));
    bindings.add(new BindingDocumentationDto("y", "Release Year", "2005", BindingCategory.GENERAL));
    bindings.add(
        new BindingDocumentationDto(
            "vf", "Video Format / Resolution", "1080p", BindingCategory.VIDEO));
    bindings.add(new BindingDocumentationDto("vc", "Video Codec", "x264", BindingCategory.VIDEO));
    bindings.add(new BindingDocumentationDto("ac", "Audio Codec", "AAC", BindingCategory.AUDIO));
    bindings.add(
        new BindingDocumentationDto("group", "Release Group", "SubGroup", BindingCategory.GENERAL));
    return bindings;
  }

  @Override
  public boolean validateExpressionSyntax(String expression) {
    if (expression == null || expression.isBlank()) {
      return false;
    }
    try {
      new ExpressionFormat(expression);
      return true;
    } catch (Exception e) {
      return false;
    }
  }
}
