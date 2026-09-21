package net.filebot.backend.websocket;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import net.filebot.backend.domain.NotificationLevel;
import net.filebot.backend.dto.AppNotificationDto;
import net.filebot.backend.dto.ChecksumProgressEventDto;
import net.filebot.backend.dto.RenameProgressEventDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class TaskProgressPublisher {

  private final List<Object> publishedEvents = new ArrayList<>();
  private final SimpMessagingTemplate messagingTemplate;

  public TaskProgressPublisher() {
    this(null);
  }

  @Autowired
  public TaskProgressPublisher(SimpMessagingTemplate messagingTemplate) {
    this.messagingTemplate = messagingTemplate;
  }

  public void publishRenameProgress(
      String taskId, int processed, int total, String currentFile, double percentage) {
    RenameProgressEventDto event =
        new RenameProgressEventDto(taskId, processed, total, currentFile, percentage);
    publishedEvents.add(event);
    if (messagingTemplate != null) {
      messagingTemplate.convertAndSend(WebSocketConfig.TOPIC_RENAME_PROGRESS, event);
    }
  }

  public void publishSfvProgress(ChecksumProgressEventDto progressEvent) {
    if (progressEvent != null) {
      publishedEvents.add(progressEvent);
      if (messagingTemplate != null) {
        messagingTemplate.convertAndSend(WebSocketConfig.TOPIC_SFV_PROGRESS, progressEvent);
      }
    }
  }

  public void publishNotification(NotificationLevel level, String message) {
    AppNotificationDto event = new AppNotificationDto(level, message, Instant.now());
    publishedEvents.add(event);
    if (messagingTemplate != null) {
      messagingTemplate.convertAndSend(WebSocketConfig.TOPIC_NOTIFICATIONS, event);
    }
  }

  public List<Object> getPublishedEvents() {
    return publishedEvents;
  }
}
