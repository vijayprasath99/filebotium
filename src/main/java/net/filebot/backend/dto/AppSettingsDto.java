package net.filebot.backend.dto;

import java.io.Serializable;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;

public record AppSettingsDto(
    LanguageCode defaultLanguage,
    FileAction defaultAction,
    String tvFormat,
    String movieFormat,
    String musicFormat,
    String animeFormat,
    boolean filterHiddenFiles,
    boolean recursiveSearch)
    implements Serializable {}
