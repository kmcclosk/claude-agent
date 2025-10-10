# MCP Servers

This directory contains Model Context Protocol (MCP) server implementations that can be used with Claude Agent SDK.

## Available Servers

### Time Server (`time-server.ts`)

A simple MCP server that provides current time information in various formats.

**Tools:**
- `getCurrentTime`: Returns the current time with support for multiple formats and timezones

**Parameters:**
- `format` (optional): Output format - 'iso', 'unix', 'locale', or 'utc' (default: 'iso')
- `timezone` (optional): Timezone string (e.g., 'America/New_York') (default: 'UTC')

**Usage:**

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { timeServer } from './mcp/time-server.js';

const agent = query({
  prompt: 'What is the current time?',
  options: {
    mcpServers: { 'time-server': timeServer }
  }
});

for await (const message of agent) {
  // Handle messages
}
```

## Creating New MCP Servers

To create a new MCP server:

1. Create a new file in this directory (e.g., `my-server.ts`)
2. Import `createSdkMcpServer` and `tool` from the SDK
3. Define your tools using the `tool()` helper
4. Export your server using `createSdkMcpServer()`

**Example:**

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

export const myServer = createSdkMcpServer({
  name: 'my-server',
  version: '1.0.0',
  tools: [
    tool(
      'myTool',
      'Description of what the tool does',
      {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'Parameter description'
          }
        }
      },
      async ({ param1 }) => {
        // Tool implementation
        return { result: 'value' };
      }
    )
  ]
});
```

## References

- [Claude Agent SDK Documentation](https://github.com/anthropics/claude-agent-sdk)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
