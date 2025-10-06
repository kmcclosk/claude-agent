import { Agent, AgentOptions, Tool } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'events';
import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import jsonrpc from 'jsonrpc-lite';
import { A2AAgentCard, A2AMessage, A2APart, A2ATask } from '../a2a/types.js';

export interface BaseA2AAgentOptions extends AgentOptions {
  name: string;
  description: string;
  port: number;
  capabilities?: string[];
  version?: string;
}

/**
 * Base class for A2A-enabled Claude agents
 * Combines Claude Agent SDK functionality with A2A protocol support
 */
export class BaseA2AAgent extends EventEmitter {
  protected agent: Agent;
  protected server: Express;
  protected httpServer?: Server;
  protected tasks: Map<string, A2ATask> = new Map();

  public readonly name: string;
  public readonly description: string;
  public readonly port: number;
  public readonly capabilities: string[];
  public readonly version: string;

  constructor(options: BaseA2AAgentOptions) {
    super();

    this.name = options.name;
    this.description = options.description;
    this.port = options.port;
    this.capabilities = options.capabilities || [];
    this.version = options.version || '1.0.0';

    // Initialize Claude Agent SDK
    this.agent = new Agent(options);

    // Initialize Express server for A2A protocol
    this.server = express();
    this.setupA2AEndpoints();
  }

  /**
   * Generate Agent Card for A2A discovery
   */
  public getAgentCard(): A2AAgentCard {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      capabilities: this.capabilities,
      endpoints: {
        base: `http://localhost:${this.port}`,
        rpc: `http://localhost:${this.port}/rpc`,
        card: `http://localhost:${this.port}/agent-card`,
        tasks: `http://localhost:${this.port}/tasks`,
      },
      authentication: {
        type: 'api-key',
        required: false,
      },
      supportedContentTypes: ['text/plain', 'application/json'],
      maxConcurrentTasks: 5,
    };
  }

  /**
   * Set up A2A protocol endpoints
   */
  protected setupA2AEndpoints(): void {
    this.server.use(express.json());

    // Agent Card endpoint
    this.server.get('/agent-card', (req, res) => {
      res.json(this.getAgentCard());
    });

    // JSON-RPC endpoint
    this.server.post('/rpc', async (req, res) => {
      const parsed = jsonrpc.parseObject(req.body);

      if (parsed.type === 'request' && parsed.payload) {
        const result = await this.handleRPCRequest(parsed.payload);
        res.json(result);
      } else {
        res.json(jsonrpc.error(null, jsonrpc.JsonRpcError.invalidRequest()));
      }
    });

    // Task management endpoints
    this.server.get('/tasks', (req, res) => {
      const tasks = Array.from(this.tasks.values());
      res.json(tasks);
    });

    this.server.get('/tasks/:id', (req, res) => {
      const task = this.tasks.get(req.params.id);
      if (task) {
        res.json(task);
      } else {
        res.status(404).json({ error: 'Task not found' });
      }
    });

    this.server.post('/tasks', async (req, res) => {
      const task = await this.createTask(req.body);
      res.json(task);
    });
  }

  /**
   * Handle JSON-RPC requests
   */
  protected async handleRPCRequest(request: any): Promise<any> {
    try {
      switch (request.method) {
        case 'task.create':
          const task = await this.createTask(request.params);
          return jsonrpc.success(request.id, task);

        case 'task.get':
          const existingTask = this.tasks.get(request.params.id);
          if (existingTask) {
            return jsonrpc.success(request.id, existingTask);
          }
          return jsonrpc.error(request.id, new jsonrpc.JsonRpcError('Task not found', 404));

        case 'task.update':
          const updatedTask = await this.updateTask(request.params.id, request.params.updates);
          return jsonrpc.success(request.id, updatedTask);

        case 'agent.capabilities':
          return jsonrpc.success(request.id, this.getAgentCard());

        default:
          return jsonrpc.error(
            request.id,
            new jsonrpc.JsonRpcError('Method not found', -32601)
          );
      }
    } catch (error: any) {
      return jsonrpc.error(
        request.id,
        new jsonrpc.JsonRpcError(error.message, -32603)
      );
    }
  }

  /**
   * Create a new task
   */
  protected async createTask(params: any): Promise<A2ATask> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task: A2ATask = {
      id: taskId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      messages: [],
      metadata: params.metadata || {},
    };

    if (params.message) {
      task.messages.push(params.message);
    }

    this.tasks.set(taskId, task);

    // Process task asynchronously
    this.processTask(taskId).catch(error => {
      console.error(`Error processing task ${taskId}:`, error);
      task.status = 'failed';
      task.error = error.message;
    });

    return task;
  }

  /**
   * Update an existing task
   */
  protected async updateTask(taskId: string, updates: any): Promise<A2ATask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (updates.message) {
      task.messages.push(updates.message);
    }

    if (updates.status) {
      task.status = updates.status;
    }

    if (updates.metadata) {
      task.metadata = { ...task.metadata, ...updates.metadata };
    }

    task.updatedAt = new Date().toISOString();

    return task;
  }

  /**
   * Process a task using the Claude Agent
   * Override this method in specialized agents
   */
  protected async processTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'in_progress';

    try {
      // Extract the latest user message
      const lastMessage = task.messages[task.messages.length - 1];
      if (!lastMessage) {
        throw new Error('No message provided');
      }

      // Convert A2A message to text for Claude
      const messageText = this.extractTextFromMessage(lastMessage);

      // Process with Claude Agent SDK
      const response = await this.agent.sendMessage(messageText);

      // Convert response back to A2A format
      const responseMessage: A2AMessage = {
        role: 'assistant',
        parts: [
          {
            type: 'text',
            content: response.content,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      task.messages.push(responseMessage);
      task.status = 'completed';
      task.completedAt = new Date().toISOString();

      // Emit task completion event
      this.emit('task:completed', task);
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      this.emit('task:failed', task, error);
    }
  }

  /**
   * Extract text content from A2A message
   */
  protected extractTextFromMessage(message: A2AMessage): string {
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => part.content)
      .join('\n');
  }

  /**
   * Start the A2A server
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = this.server.listen(this.port, () => {
        console.log(`${this.name} listening on port ${this.port}`);
        console.log(`Agent Card available at http://localhost:${this.port}/agent-card`);
        this.emit('ready');
        resolve();
      });
    });
  }

  /**
   * Stop the A2A server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.emit('stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Register a custom tool with the agent
   */
  public registerTool(tool: Tool): void {
    // This would integrate with Claude Agent SDK's tool system
    console.log(`Registering tool: ${tool.name}`);
  }

  /**
   * Send a request to another A2A agent
   */
  public async callAgent(agentUrl: string, method: string, params: any): Promise<any> {
    const rpcRequest = jsonrpc.request(
      `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method,
      params
    );

    const response = await fetch(`${agentUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcRequest),
    });

    const result = await response.json();
    const parsed = jsonrpc.parseObject(result);

    if (parsed.type === 'success' && parsed.payload) {
      return parsed.payload.result;
    } else if (parsed.type === 'error' && parsed.payload) {
      throw new Error(parsed.payload.error.message);
    } else {
      throw new Error('Invalid response from agent');
    }
  }
}