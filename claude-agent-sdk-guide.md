# Claude Agent SDK - Deep Dive Guide

## Overview
The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) enables programmatic control of AI agents with Claude Code's capabilities. This guide explores the SDK internals and practical usage patterns beyond the official documentation.

## Core Architecture

### 1. Main Entry Points
- **sdk.mjs**: Main module (ES module format)
- **sdk.d.ts**: TypeScript type definitions
- **cli.js**: Command-line interface implementation (minified)

### 2. Key Interfaces & Types

#### Query Interface
The central interface for interacting with Claude:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Basic usage
const agent = query({
  prompt: string | AsyncIterable<SDKUserMessage>,
  options?: Options
});
```

The `Query` interface extends `AsyncGenerator<SDKMessage, void>` and provides:
- `interrupt()`: Stop execution
- `setPermissionMode(mode)`: Control permission behavior
- `setModel(model)`: Switch models dynamically
- `supportedCommands()`: Get available slash commands
- `supportedModels()`: List available models
- `mcpServerStatus()`: Check MCP server connections

#### Agent Definitions
Create specialized agents with specific capabilities:

```typescript
type AgentDefinition = {
  description: string;
  tools?: string[];  // Specific tools this agent can use
  prompt: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
};
```

### 3. Message Types

The SDK uses a rich message type system:

- **SDKUserMessage**: User prompts and inputs
- **SDKAssistantMessage**: Claude's responses
- **SDKResultMessage**: Execution results (success/error)
- **SDKSystemMessage**: System initialization info
- **SDKPartialAssistantMessage**: Streaming response events
- **SDKCompactBoundaryMessage**: Context management markers

### 4. Available Tools

The SDK provides extensive tool definitions (`sdk-tools.d.ts`):

#### File Operations
- `FileReadInput`: Read files with offset/limit support
- `FileWriteInput`: Create/overwrite files
- `FileEditInput`: Replace text in files (with `replace_all` option)
- `NotebookEditInput`: Edit Jupyter notebooks

#### Code Search & Analysis
- `GlobInput`: Find files by pattern
- `GrepInput`: Advanced regex search with ripgrep
  - Supports output modes: content, files_with_matches, count
  - Context lines (-A, -B, -C)
  - Case-insensitive (-i)
  - Multiline patterns

#### System Operations
- `BashInput`: Execute commands with timeout control
- `BashOutputInput`: Read from background processes
- `KillShellInput`: Terminate background processes

#### Task Management
- `TodoWriteInput`: Structured task tracking
- `AgentInput`: Launch specialized sub-agents
- `ExitPlanModeInput`: Plan mode control

#### Web Operations
- `WebFetchInput`: Fetch and analyze web content
- `WebSearchInput`: Search with domain filtering

#### MCP (Model Context Protocol)
- `ListMcpResourcesInput`: List available resources
- `ReadMcpResourceInput`: Read MCP resources
- `McpInput`: Generic MCP operations

## Advanced Usage Patterns

### 1. Creating a Custom Agent with Specific Tools

```javascript
import { query } from '@anthropic-ai/claude-agent-sdk';

const codeReviewAgent = query({
  prompt: "Review the code in src/ directory",
  options: {
    agents: {
      'code-reviewer': {
        description: 'Specialized code review agent',
        tools: ['Grep', 'FileRead', 'FileEdit'],
        prompt: 'You are a code review specialist. Focus on code quality, security, and best practices.',
        model: 'sonnet'
      }
    },
    allowedTools: ['Grep', 'FileRead', 'FileEdit'],
    maxTurns: 10
  }
});

// Process messages
for await (const message of codeReviewAgent) {
  console.log('Message type:', message.type);

  if (message.type === 'result') {
    console.log('Execution completed:', message.subtype);
    console.log('Cost:', message.total_cost_usd);
    console.log('Tokens used:', message.usage);
  }
}
```

### 2. Streaming with Partial Messages

```javascript
const streamingAgent = query({
  prompt: "Analyze the project structure",
  options: {
    includePartialMessages: true
  }
});

for await (const message of streamingAgent) {
  if (message.type === 'stream_event') {
    // Handle streaming events
    const event = message.event;
    // Process real-time updates
  }
}
```

### 3. Permission Control

```javascript
const secureAgent = query({
  prompt: "Refactor the authentication module",
  options: {
    permissionMode: 'default', // 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
    canUseTool: async (toolName, input, { signal, suggestions }) => {
      // Custom permission logic
      if (toolName === 'FileWrite' && input.file_path.includes('sensitive')) {
        return {
          behavior: 'deny',
          message: 'Cannot modify sensitive files',
          interrupt: true
        };
      }
      return {
        behavior: 'allow',
        updatedInput: input,
        updatedPermissions: suggestions
      };
    }
  }
});
```

### 4. Hook System for Monitoring

```javascript
const monitoredAgent = query({
  prompt: "Build a new feature",
  options: {
    hooks: {
      PreToolUse: [{
        hooks: [async (input, toolUseId, { signal }) => {
          console.log(`Tool ${input.tool_name} starting`);
          return { continue: true };
        }]
      }],
      PostToolUse: [{
        hooks: [async (input, toolUseId, { signal }) => {
          console.log(`Tool ${input.tool_name} completed`);
          return { continue: true };
        }]
      }]
    }
  }
});
```

### 5. MCP Server Integration

```javascript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Define custom tool
const customTool = tool(
  'database-query',
  'Execute database queries',
  {
    query: z.string(),
    database: z.string()
  },
  async (args) => {
    // Tool implementation
    return {
      content: [{
        type: 'text',
        text: `Query executed: ${args.query}`
      }]
    };
  }
);

// Create MCP server
const mcpServer = createSdkMcpServer({
  name: 'custom-tools',
  version: '1.0.0',
  tools: [customTool]
});

// Use with agent
const agentWithMcp = query({
  prompt: "Query the user database",
  options: {
    mcpServers: {
      'custom-tools': mcpServer
    }
  }
});
```

### 6. Background Task Management

```javascript
const backgroundAgent = query({
  prompt: "Run the test suite in background",
  options: {}
});

for await (const message of backgroundAgent) {
  if (message.type === 'assistant') {
    // Check if tool was used
    const toolUses = message.message.content.filter(c => c.type === 'tool_use');

    for (const toolUse of toolUses) {
      if (toolUse.name === 'Bash' && toolUse.input.run_in_background) {
        console.log('Background process started:', toolUse.id);
        // Later retrieve output with BashOutput tool
      }
    }
  }
}
```

### 7. Error Handling & Recovery

```javascript
const resilientAgent = query({
  prompt: "Complex multi-step task",
  options: {
    maxTurns: 20,
    abortController: new AbortController(),
    fallbackModel: 'haiku'
  }
});

try {
  for await (const message of resilientAgent) {
    if (message.type === 'result' && message.subtype === 'error_during_execution') {
      console.error('Execution error detected');
      // Handle specific error scenarios
    }
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Operation aborted');
  }
}
```

## Key Insights from SDK Internals

### 1. Token & Cost Management
The SDK tracks detailed usage metrics:
- Input/output tokens per model
- Cache read/creation tokens
- Web search requests
- Cost in USD
- Context window usage

### 2. Permission System
Three-level permission configuration:
- **Session**: Temporary permissions
- **Project**: Project-specific settings
- **User**: Global user preferences

### 3. Tool Categories
Tools are internally categorized for:
- File operations
- Search & analysis
- System commands
- Web interactions
- Task management
- MCP integrations

### 4. Message Flow
1. User prompt → SDK
2. SDK → Tool execution
3. Tool results → SDK processing
4. SDK → Assistant message generation
5. Assistant message → User

### 5. WebAssembly Integration
The SDK includes `yoga.wasm` for layout calculations, suggesting UI/rendering capabilities.

## Best Practices

1. **Use specific tool allowlists** to limit agent capabilities
2. **Implement custom permission handlers** for sensitive operations
3. **Monitor costs** via usage metrics in result messages
4. **Use hooks** for logging and debugging
5. **Handle streaming events** for real-time feedback
6. **Create specialized agents** for focused tasks
7. **Use background execution** for long-running operations
8. **Implement proper error handling** with fallback strategies

## Example: Building a Code Migration Agent

```javascript
import { query } from '@anthropic-ai/claude-agent-sdk';

async function migrateCodebase() {
  const migrationAgent = query({
    prompt: `
      Migrate all JavaScript files from CommonJS to ES modules:
      1. Find all .js files
      2. Convert require() to import
      3. Convert module.exports to export
      4. Update package.json
      5. Run tests to verify
    `,
    options: {
      agents: {
        'migration-specialist': {
          description: 'Code migration expert',
          tools: ['Glob', 'FileRead', 'FileEdit', 'Bash'],
          prompt: 'You are an expert at code migration. Be careful and test changes.',
          model: 'opus'
        }
      },
      permissionMode: 'acceptEdits',
      maxTurns: 50,
      hooks: {
        PreToolUse: [{
          matcher: 'FileEdit',
          hooks: [async (input) => {
            console.log(`Editing file: ${input.tool_input.file_path}`);
            return { continue: true };
          }]
        }]
      }
    }
  });

  const results = {
    filesModified: 0,
    errors: [],
    totalCost: 0
  };

  for await (const message of migrationAgent) {
    switch (message.type) {
      case 'assistant':
        // Track file modifications
        const edits = message.message.content.filter(
          c => c.type === 'tool_use' && c.name === 'FileEdit'
        );
        results.filesModified += edits.length;
        break;

      case 'result':
        results.totalCost = message.total_cost_usd;
        if (message.subtype !== 'success') {
          results.errors.push(message);
        }
        break;
    }
  }

  return results;
}
```

## Conclusion

The Claude Agent SDK provides a powerful framework for building autonomous AI agents. Key strengths include:

- Rich type system for type-safe development
- Extensive tool library covering file, search, system, and web operations
- Flexible permission and hook systems
- Support for streaming and background operations
- MCP integration for custom tools
- Detailed cost and usage tracking

By understanding these internals, you can build sophisticated agents that go well beyond basic prompt-response interactions.