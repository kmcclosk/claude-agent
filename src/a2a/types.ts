/**
 * A2A Protocol Type Definitions
 */

/**
 * Agent Card - Describes agent capabilities and endpoints
 */
export interface A2AAgentCard {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  endpoints: {
    base: string;
    rpc: string;
    card: string;
    tasks: string;
  };
  authentication: {
    type: 'none' | 'api-key' | 'oauth2';
    required: boolean;
  };
  supportedContentTypes: string[];
  maxConcurrentTasks: number;
  metadata?: Record<string, any>;
}

/**
 * A2A Message Part - Content container
 */
export interface A2APart {
  type: 'text' | 'file' | 'data' | 'artifact';
  content?: string;
  mimeType?: string;
  encoding?: 'base64' | 'utf-8';
  metadata?: Record<string, any>;
  file?: {
    name: string;
    path?: string;
    size?: number;
  };
  data?: Record<string, any>;
  artifact?: {
    id: string;
    type: string;
    title: string;
    content: any;
  };
}

/**
 * A2A Message - Communication turn
 */
export interface A2AMessage {
  role: 'user' | 'assistant' | 'system';
  parts: A2APart[];
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * A2A Task - Stateful unit of work
 */
export interface A2ATask {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  messages: A2AMessage[];
  artifacts?: any[];
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  error?: string;
  metadata: Record<string, any>;
}

/**
 * A2A Request - JSON-RPC request format
 */
export interface A2ARequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

/**
 * A2A Response - JSON-RPC response format
 */
export interface A2AResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Agent Registry Entry
 */
export interface AgentRegistryEntry {
  agentCard: A2AAgentCard;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string;
  registeredAt: string;
}

/**
 * Task Delegation Request
 */
export interface TaskDelegationRequest {
  fromAgent: string;
  toAgent: string;
  task: {
    description: string;
    context?: any;
    requirements?: string[];
    deadline?: string;
  };
}

/**
 * A2A Methods - Standard RPC method names
 */
export enum A2AMethods {
  // Task Management
  TASK_CREATE = 'task.create',
  TASK_GET = 'task.get',
  TASK_UPDATE = 'task.update',
  TASK_CANCEL = 'task.cancel',
  TASK_LIST = 'task.list',

  // Agent Discovery
  AGENT_CAPABILITIES = 'agent.capabilities',
  AGENT_STATUS = 'agent.status',
  AGENT_PING = 'agent.ping',

  // Communication
  MESSAGE_SEND = 'message.send',
  MESSAGE_STREAM = 'message.stream',

  // Artifacts
  ARTIFACT_CREATE = 'artifact.create',
  ARTIFACT_GET = 'artifact.get',
  ARTIFACT_LIST = 'artifact.list',
}

/**
 * A2A Error Codes
 */
export enum A2AErrorCodes {
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // Custom A2A errors (starting from -32000)
  TASK_NOT_FOUND = -32001,
  AGENT_NOT_AVAILABLE = -32002,
  AUTHENTICATION_REQUIRED = -32003,
  RATE_LIMIT_EXCEEDED = -32004,
  TASK_TIMEOUT = -32005,
  CAPABILITY_NOT_SUPPORTED = -32006,
}