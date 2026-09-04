package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.BindingCategory;

public record BindingDocumentationDto(
    String bindingKey, String description, String exampleValue, BindingCategory category)
    implements Serializable {}
