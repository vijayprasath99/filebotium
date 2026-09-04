package net.filebot.backend.dto;

import java.io.Serializable;

public record FormatEvaluationResultDto(
    String expression, String result, boolean isError, String errorMessage, long executionTimeMs)
    implements Serializable {}
