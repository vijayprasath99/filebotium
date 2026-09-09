import { Client, IMessage, StompHeaders } from '@stomp/stompjs';
import { apiLogger } from '../utils/apiLogger';

export type WebSocketStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR';

type MessageCallback = (payload: any, rawMessage: IMessage) => void;

class WebSocketClient {
  private client: Client | null = null;
  private status: WebSocketStatus = 'DISCONNECTED';
  private statusListeners: Set<(status: WebSocketStatus) => void> = new Set();
  private topicSubscriptions: Map<string, Set<MessageCallback>> = new Map();
  private isExplicitDisconnect = false;

  private getBrokerUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // When running inside Vite dev server (port 5173), direct to port 8080 or use current host
    if (window.location.port === '5173') {
      return 'ws://localhost:8080/api/ws';
    }
    return `${protocol}//${window.location.host}/api/ws`;
  }

  public getStatus(): WebSocketStatus {
    return this.status;
  }

  public onStatusChange(listener: (status: WebSocketStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(newStatus: WebSocketStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((l) => {
      try {
        l(newStatus);
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    });
  }

  public connect() {
    if (this.client?.active) {
      return;
    }

    this.isExplicitDisconnect = false;
    this.setStatus('CONNECTING');

    const brokerURL = this.getBrokerUrl();

    this.client = new Client({
      brokerURL,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg: string) => {
        // Can be uncommented if verbose STOMP protocol frames needed:
        // console.debug('[STOMP Frame]:', msg);
      },
      onConnect: () => {
        this.setStatus('CONNECTED');
        apiLogger.logWsConnect(brokerURL);

        // Re-subscribe to all registered topics
        this.topicSubscriptions.forEach((callbacks, topic) => {
          this.subscribeToBroker(topic);
        });

        // Ensure default system topics are registered
        this.ensureDefaultSubscriptions();
      },
      onDisconnect: () => {
        this.setStatus('DISCONNECTED');
        apiLogger.logWsDisconnect('STOMP session disconnected');
      },
      onStompError: (frame) => {
        this.setStatus('ERROR');
        apiLogger.logWsError({
          message: frame.headers?.['message'] || 'STOMP Error Frame',
          body: frame.body,
          headers: frame.headers,
        });
      },
      onWebSocketError: (event) => {
        this.setStatus('ERROR');
        apiLogger.logWsError(event);
      },
      onWebSocketClose: (event) => {
        if (!this.isExplicitDisconnect) {
          this.setStatus('DISCONNECTED');
          apiLogger.logWsDisconnect(`WebSocket transport closed (code: ${event.code})`);
        }
      },
    });

    try {
      this.client.activate();
    } catch (err) {
      this.setStatus('ERROR');
      apiLogger.logWsError(err);
    }
  }

  public disconnect() {
    this.isExplicitDisconnect = true;
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (err) {
        console.error('Error deactivating STOMP client:', err);
      }
    }
    this.setStatus('DISCONNECTED');
  }

  private ensureDefaultSubscriptions() {
    const defaultTopics = [
      '/topic/rename/progress',
      '/topic/sfv/progress',
      '/topic/notifications',
    ];

    defaultTopics.forEach((topic) => {
      if (!this.topicSubscriptions.has(topic)) {
        this.topicSubscriptions.set(topic, new Set());
        this.subscribeToBroker(topic);
      }
    });
  }

  private subscribeToBroker(topic: string) {
    if (!this.client || !this.client.connected) {
      return;
    }

    try {
      this.client.subscribe(topic, (message: IMessage) => {
        let payload: any = message.body;
        try {
          payload = JSON.parse(message.body);
        } catch {
          // Plain text message
        }

        apiLogger.logWsReceive(topic, payload, message.headers);

        const callbacks = this.topicSubscriptions.get(topic);
        if (callbacks) {
          callbacks.forEach((cb) => {
            try {
              cb(payload, message);
            } catch (err) {
              console.error(`Error in subscriber callback for ${topic}:`, err);
            }
          });
        }
      });
    } catch (err) {
      console.error(`Failed to subscribe to ${topic}:`, err);
    }
  }

  public subscribe(topic: string, callback: MessageCallback): () => void {
    if (!this.topicSubscriptions.has(topic)) {
      this.topicSubscriptions.set(topic, new Set());
      if (this.client?.connected) {
        this.subscribeToBroker(topic);
      }
    }

    const callbacks = this.topicSubscriptions.get(topic)!;
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.topicSubscriptions.delete(topic);
      }
    };
  }

  public send(destination: string, body: any, headers: StompHeaders = {}) {
    if (!this.client || !this.client.connected) {
      console.warn(`Cannot send message to ${destination}: STOMP is not connected.`);
      return;
    }

    const stringBody = typeof body === 'string' ? body : JSON.stringify(body);
    apiLogger.logWsSend(destination, body, headers);

    this.client.publish({
      destination,
      body: stringBody,
      headers,
    });
  }
}

export const websocketClient = new WebSocketClient();
