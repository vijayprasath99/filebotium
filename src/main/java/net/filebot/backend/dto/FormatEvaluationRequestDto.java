package net.filebot.backend.dto;

import java.io.Serializable;

public record FormatEvaluationRequestDto(
    String expression, String sampleFilePath, Object sampleMetadata) implements Serializable {}
