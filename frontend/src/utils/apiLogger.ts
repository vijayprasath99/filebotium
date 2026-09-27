export type ApiLogType = 'REST' | 'WS';

export type ApiLogSubtype =
  | 'REQUEST'
  | 'RESPONSE'
  | 'ERROR'
  | 'CONNECT'
  | 'DISCONNECT'
  | 'SEND'
  | 'RECEIVE';

export interface ApiLogEntry {
  id: string;
  timestamp: Date;
  timeString: string;
  type: ApiLogType;
  subtype: ApiLogSubtype;
  methodOrTopic: string;
  urlOrDestination: string;
  status?: number | string;
  durationMs?: number;
  requestData?: any;
  responseData?: any;
  headers?: Record<string, any>;
  isError?: boolean;
}

type LogListener = (logs: ApiLogEntry[]) => void;

class ApiLogger {
  private logs: ApiLogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 300;

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = [...this.logs];
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in ApiLogger listener:', err);
      }
    });
  }

  private addLog(entry: Omit<ApiLogEntry, 'id' | 'timestamp' | 'timeString'>): ApiLogEntry {
    const now = new Date();
    const fullEntry: ApiLogEntry = {
      ...entry,
      id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      timeString: now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0'),
    };

    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.notify();
    return fullEntry;
  }

  public logRestRequest(params: {
    method: string;
    url: string;
    queryParams?: any;
    body?: any;
    headers?: any;
  }): string {
    const method = params.method.toUpperCase();
    const entry = this.addLog({
      type: 'REST',
      subtype: 'REQUEST',
      methodOrTopic: method,
      urlOrDestination: params.url,
      status: 'PENDING',
      requestData: {
        params: params.queryParams,
        body: params.body,
      },
      headers: params.headers,
    });

    console.groupCollapsed(
      `%c[REST REQ]%c ${method} %c${params.url}`,
      'background: #0284c7; color: white; padding: 1px 4px; border-radius: 2px; font-weight: bold;',
      'color: #0369a1; font-weight: bold;',
      'color: #334155;'
    );
    if (params.queryParams && Object.keys(params.queryParams).length > 0) {
      console.log('Query Params:', params.queryParams);
    }
    if (params.body) {
      console.log('Request Body:', params.body);
    }
    if (params.headers) {
      console.log('Headers:', params.headers);
    }
    console.groupEnd();

    return entry.id;
  }

  public logRestResponse(params: {
    logId?: string;
    method: string;
    url: string;
    status: number;
    durationMs: number;
    data: any;
    headers?: any;
  }) {
    const method = params.method.toUpperCase();
    const isError = params.status >= 400;
    const badgeColor = isError ? 'background: #dc2626;' : 'background: #16a34a;';

    // Update existing request entry in place if logId is provided
    let entry = params.logId ? this.logs.find((l) => l.id === params.logId) : null;
    if (entry) {
      entry.subtype = isError ? 'ERROR' : 'RESPONSE';
      entry.status = params.status;
      entry.durationMs = params.durationMs;
      entry.responseData = params.data;
      entry.isError = isError;
      this.notify();
    } else {
      entry = this.addLog({
        type: 'REST',
        subtype: isError ? 'ERROR' : 'RESPONSE',
        methodOrTopic: method,
        urlOrDestination: params.url,
        status: params.status,
        durationMs: params.durationMs,
        responseData: params.data,
        headers: params.headers,
        isError,
      });
    }

    console.groupCollapsed(
      `%c[REST ${isError ? 'ERR' : 'RES'} ${params.status}]%c ${method} %c${params.url} %c(+${params.durationMs}ms)`,
      `${badgeColor} color: white; padding: 1px 4px; border-radius: 2px; font-weight: bold;`,
      'color: #0369a1; font-weight: bold;',
      'color: #334155;',
      'color: #64748b; font-size: 11px;'
    );
    console.log('Response Payload:', params.data);
    if (params.headers) {
      console.log('Response Headers:', params.headers);
    }
    console.groupEnd();
  }

  public logRestError(params: {
    logId?: string;
    method: string;
    url: string;
    status?: number;
    durationMs?: number;
    error: any;
    data?: any;
  }) {
    const method = (params.method || 'GET').toUpperCase();
    const status = params.status || 'ERR';

    let entry = params.logId ? this.logs.find((l) => l.id === params.logId) : null;
    if (entry) {
      entry.subtype = 'ERROR';
      entry.status = status;
      entry.durationMs = params.durationMs;
      entry.responseData = params.data || params.error?.message || params.error;
      entry.isError = true;
      this.notify();
    } else {
      entry = this.addLog({
        type: 'REST',
        subtype: 'ERROR',
        methodOrTopic: method,
        urlOrDestination: params.url,
        status: status,
        durationMs: params.durationMs,
        responseData: params.data || params.error?.message || params.error,
        isError: true,
      });
    }

    console.groupCollapsed(
      `%c[REST ERR ${status}]%c ${method} %c${params.url}`,
      'background: #dc2626; color: white; padding: 1px 4px; border-radius: 2px; font-weight: bold;',
      'color: #b91c1c; font-weight: bold;',
      'color: #334155;'
    );
    console.error('Error Details:', params.error);
    if (params.data) {
      console.log('Error Response Data:', params.data);
    }
    console.groupEnd();
  }

  public logWsConnect(url: string) {
    this.addLog({
      type: 'WS',
      subtype: 'CONNECT',
      methodOrTopic: 'CONNECTED',
      urlOrDestination: url,
      status: 'OPEN',
    });

    console.log(
      `%c[WS CONNECT]%c Connected to STOMP Broker %c${url}`,
      'background: #7c3aed; color: white; padding: 1px 4px; border-radius: 2px; font-weight: bold;',
      'color: #6d28d9; font-weight: bold;',
      'color: #475569;'
    );
  }

  public logWsDisconnect(reason?: string) {
    this.addLog({
      type: 'WS',
      subtype: 'DISCONNECT',
      methodOrTopic: 'DISCONNECTED',
      urlOrDestination: reason || 'Connection closed',
      status: 'CLOSED',
    });

    console.log(
      `%c[WS DISCONNECT]%c STOMP Broker disconnected %c${reason || ''}`,
      'background: #d97706; color: white; padding: 1px 4px; border-radius: 2px; font-weight: bold;',
      'color: #b45309; font-weight: bold;',
      'color: #64748b;'
    );
  }

  public logWsError(error: any) {
    this.addLog({
      type: 'WS',
      subtype: 'ERROR',
      methodOrTopic: 'ERROR',
      urlOrDestination: error?.message || 'WebSocket Error',
      responseData: error,
      status: 'ERR',
      isError: true,
    });

    console.groupCollapsed(
      '%c[WS ERR]%c WebSocket / STOMP error',
      'background: #dc2626; color: white; padding: 1px 4px; border-radius: 2px; font-weight: bold;',
      'color: #b91c1c;'
    );
    console.error(error);
    console.groupEnd();
  }

  public logWsSend(destination: string, body: any, headers?: any) {
    this.addLog({
      type: 'WS',
      subtype: 'SEND',
      methodOrTopic: 'SEND',
      urlOrDestination: destination,
      requestData: body,
      headers,
    });

    console.groupCollapsed(
      `%c[WS SEND]%c ${destination}`,
      'background: #2563eb; color: white; padding: 1px 4px; border-radius: 2px; font-weight: bold;',
      'color: #1e40af;'
    );
    console.log('Outbound Message Body:', body);
    if (headers) {
      console.log('Outbound Headers:', headers);
    }
    console.groupEnd();
  }

  public logWsReceive(topic: string, payload: any, headers?: any) {
    this.addLog({
      type: 'WS',
      subtype: 'RECEIVE',
      methodOrTopic: 'RECEIVE',
      urlOrDestination: topic,
      responseData: payload,
      headers,
    });

    console.groupCollapsed(
      `%c[WS RECV]%c ${topic}`,
      'background: #9333ea; color: white; padding: 1px 4px; border-radius: 2px; font-weight: bold;',
      'color: #7e22ce; font-weight: bold;'
    );
    console.log('Inbound Topic Payload:', payload);
    if (headers) {
      console.log('Inbound Headers:', headers);
    }
    console.groupEnd();
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
    console.log('%c[API LOGGER]%c Logs cleared.', 'background: #475569; color: white; padding: 1px 4px;', 'color: #64748b;');
  }

  public getLogs(): ApiLogEntry[] {
    return [...this.logs];
  }
}

export const apiLogger = new ApiLogger();
