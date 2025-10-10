#!/usr/bin/env node

/**
 * Time Server MCP
 * A Model Context Protocol server that provides current time in various formats
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

/**
 * Create a time server MCP that provides current time tools
 */
export function createTimeServer() {
  return createSdkMcpServer({
    name: 'time-server',
    version: '1.0.0',
    tools: [
      tool(
        'getCurrentTime',
        'Returns the current time in various formats',
        {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['iso', 'unix', 'locale', 'utc'],
              description: 'The format for the time output',
              default: 'iso'
            },
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., America/New_York)',
              default: 'UTC'
            }
          }
        },
        async ({ format = 'iso', timezone = 'UTC' }) => {
          console.log('getCurrentTime', { format, timezone });

          const now = new Date();

          let timeString: string;
          switch (format) {
            case 'unix':
              timeString = Math.floor(now.getTime() / 1000).toString();
              break;
            case 'locale':
              timeString = now.toLocaleString('en-US', { timeZone: timezone });
              break;
            case 'utc':
              timeString = now.toUTCString();
              break;
            case 'iso':
            default:
              timeString = now.toISOString();
              break;
          }

          return {
            time: timeString,
            format: format,
            timezone: timezone,
            timestamp: now.getTime()
          };
        }
      )
    ]
  });
}

// Export a default instance
export const timeServer = createTimeServer();

// Run as standalone server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('⏰ Time Server MCP');
  console.log('   Name: time-server');
  console.log('   Version: 1.0.0');
  console.log('   Tools: getCurrentTime\n');
  console.log('To use this server, import it in your agent:');
  console.log('  import { timeServer } from "./mcp/time-server.js";\n');
  console.log('Then pass it to the query options:');
  console.log('  mcpServers: { "time-server": timeServer }\n');
}
