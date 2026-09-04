package net.filebot.backend.websocket;

public class WebSocketConfig {

  public static final String WS_ENDPOINT = "/ws";
  public static final String TOPIC_RENAME_PROGRESS = "/topic/rename/progress";
  public static final String TOPIC_SFV_PROGRESS = "/topic/sfv/progress";
  public static final String TOPIC_NOTIFICATIONS = "/topic/notifications";

  public String getWsEndpoint() {
    return WS_ENDPOINT;
  }
}
