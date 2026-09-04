package net.filebot.backend.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

  public static final String WS_ENDPOINT = "/ws";
  public static final String TOPIC_RENAME_PROGRESS = "/topic/rename/progress";
  public static final String TOPIC_SFV_PROGRESS = "/topic/sfv/progress";
  public static final String TOPIC_NOTIFICATIONS = "/topic/notifications";

  @Override
  public void configureMessageBroker(MessageBrokerRegistry config) {
    config.enableSimpleBroker("/topic");
    config.setApplicationDestinationPrefixes("/app");
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint(WS_ENDPOINT).setAllowedOriginPatterns("*");
  }
}
