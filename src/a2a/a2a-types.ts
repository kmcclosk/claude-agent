/**
 * A2A Protocol Type Definitions
 */

/**
 * Agent Provider - Organization providing the agent (A2A spec v0.3.0 section 5.5)
 */
export interface A2AAgentProvider {
  organization: string;
  url?: string;
}

/**
 * Agent Interface - Additional transport endpoints (A2A spec v0.3.0 section 5.5)
 */
export interface A2AAgentInterface {
  url: string;
  transport: string;  // e.g., "JSONRPC", "GRPC", "HTTP+JSON"
}

/**
 * Agent Capabilities - Protocol feature flags (A2A spec v0.3.0 section 5.5)
 */
export interface A2AAgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

/**
 * Agent Skill - Specific capability the agent can perform (A2A spec v0.3.0 section 5.5)
 */
export interface A2AAgentSkill {
  id: string;  // Required: unique skill identifier
  name: string;  // Required: human-readable skill name
  description: string;  // Required: what the skill does
  inputModes: string[];  // Required: MIME types accepted (e.g., ["application/json", "text/plain"])
  outputModes: string[];  // Required: MIME types produced (e.g., ["application/json", "image/png"])
  examples?: any[];  // Optional: usage examples
  security?: any[];  // Optional: skill-specific security requirements
}

/**
 * Agent Card - Describes agent capabilities and endpoints (A2A spec v0.3.0 section 5.5)
 */
export interface A2AAgentCard {
  // Required fields
  protocolVersion: string;  // e.g., "0.3.0"
  name: string;  // Human-readable agent name
  description: string;  // Detailed explanation of agent's purpose
  url: string;  // Primary endpoint URL
  version: string;  // Agent version
  capabilities: A2AAgentCapabilities;  // Protocol feature flags
  defaultInputModes: string[];  // MIME types (e.g., ["application/json", "text/plain"])
  defaultOutputModes: string[];  // MIME types (e.g., ["application/json", "image/png"])
  skills: A2AAgentSkill[];  // Specific agent capabilities

  // Optional fields
  preferredTransport?: string;  // e.g., "JSONRPC"
  additionalInterfaces?: A2AAgentInterface[];  // Multiple transport protocols
  provider?: A2AAgentProvider;  // Organization details
  iconUrl?: string;  // URL to agent icon
  documentationUrl?: string;  // URL to documentation
  securitySchemes?: Record<string, any>;  // Authentication methods
  security?: any[];  // Security requirements
  supportsAuthenticatedExtendedCard?: boolean;
  signatures?: any[];  // Card integrity verification
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
  role: 'user' | 'agent' | 'system';  // Changed 'assistant' to 'agent' per spec
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
  kind: 'task';  // Required per spec v0.3.0
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
