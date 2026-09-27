package net.filebot.backend.dto;

import java.io.Serializable;
import java.time.Instant;
import net.filebot.backend.domain.NotificationLevel;

public record AppNotificationDto(NotificationLevel level, String message, Instant timestamp)
    implements Serializable {}
