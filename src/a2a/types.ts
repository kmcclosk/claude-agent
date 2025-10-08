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
 * A2A Message Part - Content container (per specification)
 */
export interface A2APart {
  kind: 'text' | 'file' | 'data' | 'artifact';  // Changed from 'type' to 'kind' per spec
  // Text part
  text?: string;  // For text kind
  // File part
  file?: {
    name: string;
    mimeType?: string;
    content?: string;  // Base64 encoded
    path?: string;
    size?: number;
  };
  // Data part
  data?: Record<string, any>;  // For structured JSON data
  // Artifact part
  artifact?: {
    id: string;
    type: string;
    title: string;
    content: any;
  };
  metadata?: Record<string, any>;
}

/**
 * A2A Message - Communication turn (per specification)
 */
export interface A2AMessage {
  role: 'user' | 'assistant' | 'system';
  parts: A2APart[];
  messageId: string;  // Added per specification
  timestamp?: string;  // Made optional
  metadata?: Record<string, any>;
}

/**
 * A2A Task Status (per specification)
 */
export interface A2ATaskStatus {
  state: 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'cancelled' | 'rejected';
  message?: string;
}

/**
 * A2A Task - Stateful unit of work (per specification)
 */
export interface A2ATask {
  id: string;
  contextId: string;  // Added per specification for context management
  status: A2ATaskStatus;  // Changed to object per specification
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
 * A2A Methods - Standard RPC method names (per specification)
 */
export enum A2AMethods {
  // Message Management
  MESSAGE_SEND = 'message/send',
  MESSAGE_STREAM = 'message/stream',

  // Task Management
  TASKS_GET = 'tasks/get',
  TASKS_UPDATE = 'tasks/update',
  TASKS_CANCEL = 'tasks/cancel',
  TASKS_LIST = 'tasks/list',

  // Agent Discovery
  AGENT_CAPABILITIES = 'agent/capabilities',
  AGENT_STATUS = 'agent/status',
  AGENT_PING = 'agent/ping',

  // Artifacts
  ARTIFACTS_CREATE = 'artifacts/create',
  ARTIFACTS_GET = 'artifacts/get',
  ARTIFACTS_LIST = 'artifacts/list',
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