// import jsonrpc from 'jsonrpc-lite';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  A2ARequest,
  A2AResponse,
  A2ATask,
  A2AMessage,
  A2AMethods,
  A2AAgentCard,
} from './types.js';

/**
 * A2A Protocol Handler
 * Manages communication between agents using JSON-RPC 2.0
 */
export class A2AProtocol extends EventEmitter {
  private pendingRequests: Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private requestTimeout: number = 30000; // 30 seconds default

  constructor(requestTimeout?: number) {
    super();
    if (requestTimeout) {
      this.requestTimeout = requestTimeout;
    }
  }

  /**
   * Create a JSON-RPC request
   */
  public createRequest(method: string, params?: any): A2ARequest {
    return {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method,
      params,
    };
  }

  /**
   * Create a JSON-RPC success response
   */
  public createSuccessResponse(id: string | number, result: any): A2AResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * Create a JSON-RPC error response
   */
  public createErrorResponse(
    id: string | number,
    code: number,
    message: string,
    data?: any
  ): A2AResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }

  /**
   * Send a request to another agent via HTTP
   */
  public async sendHTTPRequest(url: string, method: string, params?: any): Promise<any> {
    const request = this.createRequest(method, params);

    const requestPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json() as A2AResponse;
      this.handleResponse(result);

      return await requestPromise;
    } catch (error) {
      const pending = this.pendingRequests.get(request.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(request.id);
      }
      throw error;
    }
  }

  /**
   * Handle incoming JSON-RPC response
   */
  protected handleResponse(response: A2AResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn(`No pending request found for response ID: ${response.id}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Parse and validate incoming JSON-RPC request
   */
  public parseRequest(data: string | object): A2ARequest | null {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      if (parsed.jsonrpc !== '2.0' || !parsed.method) {
        return null;
      }

      return parsed as A2ARequest;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create WebSocket connection for streaming
   */
  public createWebSocketConnection(url: string): WebSocket {
    const ws = new WebSocket(url);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('ws:message', message);

        if (message.jsonrpc === '2.0' && message.id) {
          this.handleResponse(message);
        }
      } catch (error) {
        this.emit('ws:error', error);
      }
    });

    ws.on('open', () => {
      this.emit('ws:open');
    });

    ws.on('close', () => {
      this.emit('ws:close');
    });

    ws.on('error', (error) => {
      this.emit('ws:error', error);
    });

    return ws;
  }

  /**
   * Send request via WebSocket
   */
  public sendWebSocketRequest(ws: WebSocket, method: string, params?: any): Promise<any> {
    const request = this.createRequest(method, params);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error('WebSocket request timeout'));
      }, this.requestTimeout);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });

      ws.send(JSON.stringify(request), (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id);
          reject(error);
        }
      });
    });
  }
}

/**
 * A2A Client for interacting with remote agents
 */
export class A2AClient extends A2AProtocol {
  private agentUrl: string;
  private agentCard?: A2AAgentCard;
  private ws?: WebSocket;

  constructor(agentUrl: string, requestTimeout?: number) {
    super(requestTimeout);
    this.agentUrl = agentUrl;
  }

  /**
   * Connect to the remote agent and fetch its card (per A2A spec v0.3.0)
   */
  public async connect(): Promise<A2AAgentCard> {
    const response = await fetch(`${this.agentUrl}/.well-known/agent-card.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch agent card: ${response.status}`);
    }

    const card = await response.json() as A2AAgentCard;
    this.agentCard = card;
    this.emit('connected', this.agentCard);
    return card;
  }

  /**
   * Send a message to create a new task (per specification)
   */
  public async sendMessage(message: A2AMessage, metadata?: any): Promise<A2ATask> {
    return this.sendHTTPRequest(
      `${this.agentUrl}/rpc`,
      A2AMethods.MESSAGE_SEND,
      { message, metadata }
    );
  }

  /**
   * Get task status (per specification)
   */
  public async getTask(taskId: string): Promise<A2ATask> {
    return this.sendHTTPRequest(
      `${this.agentUrl}/rpc`,
      A2AMethods.TASKS_GET,
      { id: taskId }
    );
  }

  /**
   * Update a task
   */
  public async updateTask(taskId: string, message?: A2AMessage, metadata?: any): Promise<A2ATask> {
    return this.sendHTTPRequest(
      `${this.agentUrl}/rpc`,
      A2AMethods.TASKS_UPDATE,
      { id: taskId, updates: { message, metadata } }
    );
  }

  /**
   * Get agent capabilities
   */
  public async getCapabilities(): Promise<A2AAgentCard> {
    return this.sendHTTPRequest(
      `${this.agentUrl}/rpc`,
      A2AMethods.AGENT_CAPABILITIES
    );
  }

  /**
   * Ping the agent to check if it's alive
   */
  public async ping(): Promise<boolean> {
    try {
      await this.sendHTTPRequest(
        `${this.agentUrl}/rpc`,
        A2AMethods.AGENT_PING
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start streaming connection
   */
  public startStreaming(wsUrl?: string): WebSocket {
    const url = wsUrl || `${this.agentUrl.replace('http', 'ws')}/stream`;
    this.ws = this.createWebSocketConnection(url);
    return this.ws;
  }

  /**
   * Stop streaming connection
   */
  public stopStreaming(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Send streaming message
   */
  public async sendStreamMessage(method: string, params?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    return this.sendWebSocketRequest(this.ws, method, params);
  }
}
