# Multi-Agent A2A System Implementation

A distributed multi-agent system implementing the A2A (Agent-to-Agent) protocol with Claude Agent SDK integration.

## Overview

This implementation demonstrates a complete multi-agent architecture where specialized Claude-based agents communicate using the A2A protocol standard. The system enables:

- **Distributed agent communication** via JSON-RPC 2.0 over HTTP(S)
- **Service discovery** through a centralized registry
- **Task orchestration** by a coordinator agent
- **Specialized agents** for different capabilities
- **Claude Agent SDK integration** for LLM-powered intelligence

## Architecture

```
┌─────────────────────┐
│   Agent Registry    │
│    (Port 8000)      │
└──────────┬──────────┘
           │
    Discovery & Health
           │
┌──────────┴──────────┐
│                     │
│  ┌───────────────┐  │  ┌────────────────┐
│  │  Coordinator  │──┼──│ Research Agent │
│  │  (Port 3000)  │  │  │  (Port 3001)   │
│  └───────────────┘  │  └────────────────┘
│                     │
│  ┌───────────────┐  │  ┌────────────────┐
│  │  Code Agent   │──┼──│   Data Agent   │
│  │  (Port 3002)  │  │  │  (Port 3003)   │
│  └───────────────┘  │  └────────────────┘
│                     │
└─────────────────────┘
```

## Components

### 1. Base Agent Framework (`src/agents/base-agent.ts`)
- Abstract base class extending Claude Agent SDK
- A2A protocol integration
- JSON-RPC endpoint handling
- Task lifecycle management

### 2. A2A Protocol Layer (`src/a2a/`)
- **protocol.ts**: JSON-RPC communication handler
- **types.ts**: A2A message and task type definitions
- Support for synchronous and asynchronous messaging
- WebSocket streaming capabilities

### 3. Coordinator Agent (`src/agents/coordinator.ts`)
- Orchestrates complex multi-step tasks
- Decomposes tasks into subtasks
- Delegates to specialized agents based on capabilities
- Synthesizes results from multiple agents

### 4. Specialized Agents (`src/agents/specialists/`)
- **Research Agent**: Information gathering, web search, analysis
- **Code Agent**: (Planned) Code generation, review, refactoring
- **Data Agent**: (Planned) Data processing and visualization
- **QA Agent**: (Planned) Testing and validation

### 5. Agent Registry (`src/server/registry.ts`)
- Service discovery hub
- Agent registration and health monitoring
- Capability-based agent search
- Real-time status tracking

## Installation & Setup

```bash
# Install dependencies
npm install

# Set up Claude API key (optional for full functionality)
export ANTHROPIC_API_KEY=your-api-key-here

# Build the TypeScript code
npm run build
```

## Running the System

### Quick Demo
Run the complete multi-agent demo:
```bash
npm run demo:a2a
```

This will:
1. Start the agent registry
2. Launch specialized agents
3. Demonstrate agent communication
4. Run example tasks
5. Clean up resources

### Manual Agent Startup
Start components individually:

```bash
# Terminal 1: Start the registry
npm run registry

# Terminal 2: Start research agent
npm run agent:research

# Terminal 3: Start coordinator
npm run agent:coordinator
```

## A2A Protocol Features

### Agent Cards
Each agent exposes its capabilities through an Agent Card:
```json
{
  "name": "research-agent",
  "description": "Specialized in information gathering",
  "capabilities": ["research", "web_search", "summarization"],
  "endpoints": {
    "rpc": "http://localhost:3001/rpc",
    "card": "http://localhost:3001/agent-card"
  }
}
```

### Task Management
Tasks follow a stateful lifecycle:
- **pending**: Task created, awaiting processing
- **in_progress**: Agent actively working on task
- **completed**: Task finished successfully
- **failed**: Task encountered an error

### Message Format
A2A messages support multiple content types:
```typescript
{
  "role": "user" | "assistant",
  "parts": [
    { "type": "text", "content": "..." },
    { "type": "data", "data": {...} },
    { "type": "file", "file": {...} }
  ]
}
```

## API Endpoints

### Registry Service (Port 8000)
- `GET /agents` - List all registered agents
- `POST /agents/register` - Register new agent
- `GET /agents/search/capability/:cap` - Find agents by capability
- `GET /stats` - Registry statistics

### Agent Endpoints
- `GET /agent-card` - Get agent capabilities
- `POST /rpc` - JSON-RPC endpoint
- `GET /tasks` - List agent tasks
- `POST /tasks` - Create new task

## Example Usage

### Creating a Task via Coordinator
```typescript
import { A2AClient } from './a2a/protocol.js';

const client = new A2AClient('http://localhost:3000');

const task = await client.createTask({
  role: 'user',
  parts: [{
    type: 'text',
    content: 'Research TypeScript best practices and generate a style guide'
  }],
  timestamp: new Date().toISOString()
});

// Poll for completion
const result = await client.getTask(task.id);
```

### Direct Agent Communication
```typescript
const researchClient = new A2AClient('http://localhost:3001');

const capabilities = await researchClient.getCapabilities();
console.log('Research agent can:', capabilities.capabilities);
```

## Extension Points

### Adding New Specialized Agents
1. Extend `BaseA2AAgent` class
2. Override `processTask()` method
3. Define specialized capabilities
4. Register with the discovery service

### Custom Tools
Integrate Claude Agent SDK tools:
```typescript
agent.registerTool({
  name: 'custom-tool',
  description: 'My custom tool',
  execute: async (params) => { /* ... */ }
});
```

### Protocol Extensions
The A2A protocol supports custom methods:
```typescript
// In your agent's handleRPCRequest()
case 'custom.method':
  return await this.handleCustomMethod(params);
```

## Development Status

### Implemented ✅
- Base agent framework with A2A integration
- A2A protocol layer (JSON-RPC)
- Coordinator agent with task orchestration
- Research agent implementation
- Agent registry and service discovery
- Multi-agent communication demo

### Planned 🚧
- Additional specialized agents (Code, Data, QA)
- WebSocket streaming support
- Enhanced security (OAuth2, TLS)
- Distributed task queue
- Agent performance monitoring
- Visual dashboard for system monitoring
- Enhanced error recovery and resilience

## Testing

Run the multi-agent demo to test the system:
```bash
npm run demo:a2a
```

This will demonstrate:
1. Agent registration and discovery
2. Task decomposition by coordinator
3. Delegation to specialized agents
4. Result synthesis
5. Direct agent-to-agent communication

## Architecture Benefits

1. **Modularity**: Each agent is independent and can be deployed separately
2. **Scalability**: Add more agents or instances as needed
3. **Interoperability**: A2A protocol enables communication with non-Claude agents
4. **Fault Tolerance**: Registry monitors health; coordinator handles failures
5. **Extensibility**: Easy to add new agent types and capabilities

## Security Considerations

- Agents should validate incoming requests
- Use HTTPS in production environments
- Implement authentication for agent registration
- Rate limiting for public-facing endpoints
- Sanitize data passed between agents

## Contributing

To add new features:
1. Create feature branch
2. Implement changes following existing patterns
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

## License

MIT

## References

- [A2A Protocol Specification](https://a2a-protocol.org)
- [Claude Agent SDK Documentation](https://docs.claude.com/en/api/agent-sdk)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)