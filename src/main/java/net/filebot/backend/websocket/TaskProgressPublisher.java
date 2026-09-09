package net.filebot.backend.websocket;

import java.util.ArrayList;
import java.util.List;
import net.filebot.backend.dto.ChecksumProgressEventDto;

public class TaskProgressPublisher {

  private final List<Object> publishedEvents = new ArrayList<>();

  public void publishRenameProgress(
      String taskId, int processed, int total, String currentFile, double percentage) {
    publishedEvents.add(taskId + ":" + processed + "/" + total + ":" + currentFile);
  }

  public void publishSfvProgress(ChecksumProgressEventDto progressEvent) {
    if (progressEvent != null) {
      publishedEvents.add(progressEvent);
    }
  }

  public List<Object> getPublishedEvents() {
    return publishedEvents;
  }
}
