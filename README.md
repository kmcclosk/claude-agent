# Claude Agent SDK Examples

A comprehensive collection of examples demonstrating the Claude Agent SDK capabilities, from basic usage to advanced control mechanisms.

## 📦 Installation

```bash
npm install
npm run build  # Compile TypeScript
```

## 📚 Documentation

- [Claude Agent SDK Guide](./claude-agent-sdk-guide.md) - Deep dive into SDK internals
- [Official Documentation](https://docs.claude.com/en/api/agent-sdk/overview)

## 🎯 Examples

### 1. Simple Example (`src/simple-example.ts`)

A beginner-friendly introduction to the Claude Agent SDK.

**Features:**
- Basic agent initialization
- Message handling
- Cost tracking
- Token usage monitoring

**Usage:**
```bash
npm run simple
# or
npx tsx src/simple-example.ts
```

**What it does:**
Creates a TODO list application demonstrating basic agent capabilities with limited tools (FileWrite, FileRead).

---

### 2. Interactive Agent (`src/interactive-agent.ts`)

Advanced example showing how to steer and intervene in agent execution.

**Features:**
- **Bidirectional streaming communication** - Send messages during execution
- **Real-time control methods** - interrupt(), changeModel(), setPermissionMode()
- **Dynamic permissions** - Runtime permission management
- **Hook system** - Intervention points for monitoring and control
- **AbortController** - External cancellation
- **Interactive CLI** - Command-line interface for control

**Usage:**
```bash
# Run automated demonstration
npm run interactive:demo
# or
npx tsx src/interactive-agent.ts demo

# Run interactive CLI
npm run interactive:cli
# or
npx tsx src/interactive-agent.ts cli
```

**CLI Commands:**
- `/msg <text>` - Send message to agent
- `/model <name>` - Change model (opus/sonnet/haiku)
- `/perm <type>` - Toggle permission (writes/reads/commands)
- `/interrupt` - Interrupt current execution
- `/pause` - Pause execution
- `/resume` - Resume execution
- `/history` - Show execution history
- `/stop` - Stop and exit

---

### 3. Example Agent (`src/example-agent.ts`)

Collection of practical use cases and patterns.

**Features:**
- **Code Analysis** - Analyze codebase structure and quality
- **Development Assistant** - Interactive development helper
- **Code Refactoring** - Automated refactoring with hooks
- **Background Tasks** - Long-running task management
- **Secure Operations** - Permission-based file access control

**Usage:**
```bash
# Analyze a codebase
npm run example:analyze -- [directory]
# or
npx tsx src/example-agent.ts analyze [directory]

# Start development assistant
npm run example:dev
# or
npx tsx src/example-agent.ts dev

# Refactor a file
npm run example:refactor -- <file>
# or
npx tsx src/example-agent.ts refactor <file>

# Run background tasks
npm run example:background
# or
npx tsx src/example-agent.ts background

# Demo secure file operations
npm run example:secure
# or
npx tsx src/example-agent.ts secure
```

## 🔑 Key Concepts

### Agent Control Flow

```typescript
// 1. Initialize with streaming input
const messageStream = new InteractiveMessageStream(initialPrompt);

// 2. Create agent with options
const agent = query({
  prompt: messageStream.generate(),
  options: {
    includePartialMessages: true,
    canUseTool: customPermissionHandler,
    hooks: customHooks
  }
});

// 3. Control during execution
await agent.interrupt();
await agent.setModel('opus');
await agent.setPermissionMode('bypassPermissions');

// 4. Send new messages
messageStream.sendMessage("New instruction");
```

### Permission Control

```typescript
const agent = query({
  prompt: "Task description",
  options: {
    canUseTool: async (toolName, input, { signal, suggestions }) => {
      if (shouldDeny(toolName, input)) {
        return {
          behavior: 'deny',
          message: 'Reason for denial',
          interrupt: false
        };
      }
      return {
        behavior: 'allow',
        updatedInput: input
      };
    }
  }
});
```

### Hook System

```typescript
const hooks = {
  PreToolUse: [{
    hooks: [async (input, toolUseId, { signal }) => {
      console.log(`Starting: ${input.tool_name}`);
      return { continue: true };
    }]
  }],
  PostToolUse: [{
    hooks: [async (input, toolUseId, { signal }) => {
      console.log(`Completed: ${input.tool_name}`);
      return { continue: true };
    }]
  }]
};
```

### Message Types

The SDK uses various message types:

- `SDKUserMessage` - User inputs
- `SDKAssistantMessage` - Claude's responses
- `SDKResultMessage` - Execution results
- `SDKSystemMessage` - System information
- `SDKPartialAssistantMessage` - Streaming updates

### Available Tools

| Category | Tools | Description |
|----------|-------|-------------|
| **File Operations** | FileRead, FileWrite, FileEdit, NotebookEdit | Read, write, and modify files |
| **Search** | Glob, Grep | Find files and search content |
| **System** | Bash, BashOutput, KillShell | Execute commands |
| **Web** | WebFetch, WebSearch | Access web content |
| **Task Management** | TodoWrite, Agent, ExitPlanMode | Manage tasks and sub-agents |
| **MCP** | ListMcpResources, ReadMcpResource | Model Context Protocol tools |

## 🏗️ Project Structure

```
claude-agent/
├── src/
│   ├── simple-example.ts      # Basic usage example
│   ├── interactive-agent.ts   # Advanced control example
│   └── example-agent.ts       # Practical use cases
├── dist/                       # Compiled JavaScript (generated)
├── package.json               # Project configuration
├── tsconfig.json             # TypeScript configuration
├── README.md                 # This file
└── claude-agent-sdk-guide.md # Deep dive documentation
```

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build TypeScript:**
   ```bash
   npm run build
   ```

3. **Run examples:**
   ```bash
   npm run simple           # Simple example
   npm run interactive:cli  # Interactive CLI
   npm run example:analyze  # Code analysis
   ```

## 📖 Advanced Topics

### Creating Custom Agents

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const customAgent = query({
  prompt: "Your task",
  options: {
    agents: {
      'specialist': {
        description: 'Specialized agent',
        tools: ['FileRead', 'FileWrite'],
        prompt: 'You are a specialist in...',
        model: 'opus'
      }
    }
  }
});
```

### Streaming with Partial Messages

```typescript
const agent = query({
  prompt: "Task",
  options: { includePartialMessages: true }
});

for await (const message of agent) {
  if (message.type === 'stream_event') {
    // Handle real-time updates
  }
}
```

### Cost Optimization

```typescript
// Use cheaper models for simple tasks
const agent = query({
  prompt: "Simple task",
  options: {
    model: 'haiku',  // Fastest and cheapest
    fallbackModel: 'sonnet'  // Fallback for complex cases
  }
});

// Monitor costs
for await (const message of agent) {
  if (message.type === 'result') {
    console.log(`Cost: $${message.total_cost_usd}`);
  }
}
```

## 🔧 Development

### Build from source:
```bash
npm run build
```

### Watch mode:
```bash
npm run dev
```

### Run with tsx (no build needed):
```bash
npx tsx src/simple-example.ts
```

## 📝 License

This is example code for educational purposes. Refer to the Claude Agent SDK license for usage terms.

## 🤝 Contributing

Feel free to submit issues or pull requests to improve these examples.

## 📚 Resources

- [Claude Agent SDK Documentation](https://docs.claude.com/en/api/agent-sdk/overview)
- [GitHub Issues](https://github.com/anthropics/claude-agent-sdk-typescript/issues)
- [Discord Community](https://anthropic.com/discord)