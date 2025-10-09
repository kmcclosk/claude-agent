// Simple Example: Getting Started with Claude Agent SDK
// This is a minimal example to help you start building with the SDK

import {
  query,
  type SDKSystemMessage,
  type SDKAssistantMessage,
  type SDKResultMessage
} from '@anthropic-ai/claude-agent-sdk';

export const messageOutput = {
  handleSystemMessage: (message: SDKSystemMessage): void => {
    // System initialization message
    if (message.subtype === 'init') {
      console.log('✅ Agent initialized');
      console.log(`   Model: ${message.model}`);
      console.log(`   Available tools: ${message.tools.join(', ')}\n`);
    }
  },

  handleAssistantMessage: (message: SDKAssistantMessage): void => {
    // Extract text content from assistant messages
    const textContent = message.message.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => 'text' in c ? c.text : '')
      .join('\n');

    if (textContent) {
      console.log('💬 Assistant says:');
      console.log(textContent);
      console.log('');
    }

    // Check for tool usage
    const toolUses = message.message.content.filter(c => c.type === 'tool_use');
    for (const tool of toolUses) {
      if ('name' in tool) {
        console.log(`🔧 Using tool: ${tool.name}`);
        if (tool.name === 'Write' && 'input' in tool && tool.input) {
          const input = tool.input as { file_path?: string };
          if (input.file_path) {
            console.log(`   Creating file: ${input.file_path}`);
          }
        }
      }
    }
  },

  handleResultMessage: (message: SDKResultMessage): void => {
    // Final result of the agent's work
    console.log('\n📊 Task Complete!');
    console.log(`   Status: ${message.subtype}`);
    console.log(`   Total cost: $${message.total_cost_usd.toFixed(4)}`);
    console.log(`   Input tokens: ${message.usage.input_tokens}`);
    console.log(`   Output tokens: ${message.usage.output_tokens}`);
    console.log(`   Time taken: ${message.duration_ms}ms`);

    if (message.subtype === 'success') {
      console.log('\n✨ Success! The TODO list application has been created.');
    } else {
      console.log('\n⚠️ The task encountered an issue:', message.subtype);
    }
  },
};

export const messageOutputRaw = {
  handleSystemMessage: (message: SDKSystemMessage): void => {
    console.log('system', JSON.stringify(message, null, 2));
  },

  handleAssistantMessage: (message: SDKAssistantMessage): void => {
    console.log('assistant', JSON.stringify(message, null, 2));
  },

  handleResultMessage: (message: SDKResultMessage): void => {
    console.log('result', JSON.stringify(message, null, 2));
  },
};

async function main(): Promise<void> {
  console.log('🚀 Simple Claude Agent Example\n');

  const outputter = messageOutputRaw;

  // Create a basic agent that can help with coding tasks
  const agent = query({
    prompt: "Create a simple TODO list application in JavaScript with add, remove, and list functions. Create and write to a new example directory in the current directory.",
    options: {
      // Limit which tools the agent can use
      allowedTools: ['Write', 'Read'],

      // Set maximum conversation turns
      maxTurns: 5,

      // Choose the model
      model: 'sonnet'
    }
  });

  console.log('Agent is working on your request...\n');

  // Process all messages from the agent
  for await (const message of agent) {
    // Handle different message types
    switch (message.type) {
      case 'system':
        outputter.handleSystemMessage(message as SDKSystemMessage);
        break;

      case 'assistant':
        outputter.handleAssistantMessage(message);
        break;

      case 'result':
        outputter.handleResultMessage(message);
        break;

      case 'stream_event':
        // Streaming events (if includePartialMessages is true)
        // You can use these for real-time updates
        break;
    }
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
