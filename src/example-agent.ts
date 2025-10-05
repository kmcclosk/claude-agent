#!/usr/bin/env node

// Example: Claude Agent SDK - Practical Implementation
// This demonstrates real-world usage patterns of the Claude Agent SDK

import {
  query,
  type SDKMessage,
  type SDKAssistantMessage,
  type SDKResultMessage,
  type SDKSystemMessage,
  type CanUseTool,
  type PermissionResult,
  type AgentDefinition,
  type HookInput,
  type HookJSONOutput
} from '@anthropic-ai/claude-agent-sdk';

// Type definitions
interface BackgroundProcess {
  id: string;
  command: string;
}

interface ToolUse {
  type: 'tool_use';
  name: string;
  id?: string;
  input?: any;
}

// Example 1: Simple Code Analysis Agent
async function analyzeCodebase(directory: string = './src'): Promise<string> {
  console.log('🔍 Starting codebase analysis...\n');

  const analysisAgent = query({
    prompt: `Analyze the codebase in ${directory} and provide:
    1. Project structure overview
    2. Main technologies and frameworks used
    3. Code quality assessment
    4. Potential improvements`,
    options: {
      allowedTools: ['Glob', 'Grep', 'Read'],
      maxTurns: 10
    }
  });

  let analysis = '';
  for await (const message of analysisAgent) {
    if (message.type === 'assistant') {
      const assistantMsg = message as SDKAssistantMessage;
      // Extract text content from assistant messages
      const textContent = assistantMsg.message.content
        .filter(c => c.type === 'text')
        .map(c => 'text' in c ? c.text : '')
        .join('\n');
      analysis += textContent;
    }

    if (message.type === 'result') {
      const resultMsg = message as SDKResultMessage;
      console.log(`\n✅ Analysis complete!`);
      console.log(`   Cost: $${resultMsg.total_cost_usd}`);
      console.log(`   Tokens: ${resultMsg.usage.input_tokens} in, ${resultMsg.usage.output_tokens} out`);
    }
  }

  return analysis;
}

// Example 2: Interactive Development Assistant
async function developmentAssistant(): Promise<void> {
  console.log('🤖 Development Assistant Started\n');
  console.log('Available commands:');
  console.log('  - "test": Run tests');
  console.log('  - "lint": Check code style');
  console.log('  - "build": Build the project');
  console.log('  - "fix <file>": Auto-fix issues in a file');
  console.log('  - Custom requests...\n');

  const agents: Record<string, AgentDefinition> = {
    'test-runner': {
      description: 'Runs and analyzes test results',
      tools: ['Bash', 'Read'],
      prompt: 'Run tests and provide detailed analysis of results',
      model: 'sonnet'
    },
    'linter': {
      description: 'Checks code style and quality',
      tools: ['Bash', 'Read', 'Grep'],
      prompt: 'Run linters and explain issues found',
      model: 'haiku'
    },
    'builder': {
      description: 'Builds the project',
      tools: ['Bash', 'Read'],
      prompt: 'Build the project and handle any errors',
      model: 'sonnet'
    },
    'fixer': {
      description: 'Auto-fixes code issues',
      tools: ['Read', 'Edit', 'Bash'],
      prompt: 'Identify and fix code issues automatically',
      model: 'opus'
    }
  };

  const devAgent = query({
    prompt: "You are a development assistant. Help with testing, linting, building, and fixing code issues.",
    options: {
      agents,
      permissionMode: 'acceptEdits'
    }
  });

  // Process agent messages
  for await (const message of devAgent) {
    handleAgentMessage(message);
  }
}

// Example 3: Code Refactoring with Hooks
async function refactorWithHooks(targetFile: string): Promise<ToolUse[]> {
  console.log(`🔧 Refactoring ${targetFile}\n`);

  const refactorAgent = query({
    prompt: `Refactor ${targetFile} to:
    1. Improve code readability
    2. Add proper error handling
    3. Optimize performance
    4. Add comprehensive comments`,
    options: {
      allowedTools: ['Read', 'Edit', 'Bash'],
      hooks: {
        PreToolUse: [{
          hooks: [async (input: HookInput, toolUseId: string | undefined, { signal }): Promise<HookJSONOutput> => {
            if (input.hook_event_name === 'PreToolUse') {
              console.log(`  ⚙️  ${input.tool_name}: ${JSON.stringify(input.tool_input).slice(0, 50)}...`);
            }
            return { continue: true };
          }]
        }],
        PostToolUse: [{
          hooks: [async (input: HookInput, toolUseId: string | undefined, { signal }): Promise<HookJSONOutput> => {
            if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Edit') {
              const toolInput = input.tool_input as { file_path?: string };
              console.log(`  ✏️  File modified: ${toolInput?.file_path}`);
            }
            return { continue: true };
          }]
        }]
      }
    }
  });

  const changes: ToolUse[] = [];
  for await (const message of refactorAgent) {
    if (message.type === 'assistant') {
      const assistantMsg = message as SDKAssistantMessage;
      const edits = assistantMsg.message.content.filter(
        (c): c is ToolUse => c.type === 'tool_use' && 'name' in c && c.name === 'Edit'
      );
      changes.push(...edits);
    }
  }

  return changes;
}

// Example 4: Background Task Monitoring
async function runBackgroundTasks(): Promise<BackgroundProcess[]> {
  console.log('🚀 Starting background tasks...\n');

  const bgAgent = query({
    prompt: `Run these tasks in background:
    1. npm test (in background)
    2. npm run build (in background)
    Monitor and report results when complete.`,
    options: {
      allowedTools: ['Bash', 'BashOutput'],
    }
  });

  const backgroundProcesses: BackgroundProcess[] = [];

  for await (const message of bgAgent) {
    if (message.type === 'assistant') {
      const assistantMsg = message as SDKAssistantMessage;
      // Track background processes
      const bgTasks = assistantMsg.message.content.filter(
        (c): c is ToolUse =>
          c.type === 'tool_use' &&
          'name' in c &&
          c.name === 'Bash' &&
          c.input?.run_in_background === true
      );

      for (const task of bgTasks) {
        console.log(`  📊 Started background: ${task.input.command}`);
        backgroundProcesses.push({
          id: task.id || '',
          command: task.input.command
        });
      }
    }
  }

  return backgroundProcesses;
}

// Example 5: Custom Permission Handler
async function secureFileOperations(): Promise<void> {
  console.log('🔒 Secure File Operations Mode\n');

  const canUseTool: CanUseTool = async (toolName, input, { signal, suggestions }) => {
    // Custom permission logic
    const restrictedPaths = ['.env', 'secrets.json', 'private/'];
    const filePath = (input.file_path || input.path || '') as string;

    // Check for restricted paths
    for (const restricted of restrictedPaths) {
      if (filePath.includes(restricted)) {
        console.log(`  ❌ Blocked access to: ${filePath}`);
        return {
          behavior: 'deny',
          message: `Cannot modify restricted file: ${filePath}`,
          interrupt: false
        } as PermissionResult;
      }
    }

    // Log allowed operations
    console.log(`  ✅ Allowed: ${toolName} on ${filePath || 'N/A'}`);
    return {
      behavior: 'allow',
      updatedInput: input,
      updatedPermissions: suggestions
    } as PermissionResult;
  };

  const secureAgent = query({
    prompt: "Update configuration files in the project",
    options: {
      canUseTool
    }
  });

  for await (const message of secureAgent) {
    if (message.type === 'result') {
      console.log('\nOperation complete with security checks enforced');
    }
  }
}

// Helper function to handle agent messages
function handleAgentMessage(message: SDKMessage): void {
  switch (message.type) {
    case 'system': {
      const sysMsg = message as SDKSystemMessage;
      if (sysMsg.subtype === 'init') {
        console.log('System initialized:');
        console.log(`  Model: ${sysMsg.model}`);
        console.log(`  Tools: ${sysMsg.tools.join(', ')}`);
        console.log(`  Permission mode: ${sysMsg.permissionMode}\n`);
      }
      break;
    }

    case 'assistant': {
      const assistantMsg = message as SDKAssistantMessage;
      const textContent = assistantMsg.message.content
        .filter(c => c.type === 'text')
        .map(c => 'text' in c ? c.text : '')
        .join('\n');
      if (textContent) {
        console.log('Assistant:', textContent, '\n');
      }
      break;
    }

    case 'result': {
      const resultMsg = message as SDKResultMessage;
      console.log('\n📊 Execution Summary:');
      console.log(`  Status: ${resultMsg.subtype}`);
      console.log(`  Duration: ${resultMsg.duration_ms}ms`);
      console.log(`  API calls: ${resultMsg.duration_api_ms}ms`);
      console.log(`  Turns: ${resultMsg.num_turns}`);
      console.log(`  Cost: $${resultMsg.total_cost_usd}`);
      console.log(`  Tokens: ${resultMsg.usage.input_tokens} in, ${resultMsg.usage.output_tokens} out`);

      if (resultMsg.permission_denials.length > 0) {
        console.log(`  Permission denials: ${resultMsg.permission_denials.length}`);
      }
      break;
    }

    case 'stream_event':
      // Handle streaming events if needed
      break;
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'analyze': {
        const analysis = await analyzeCodebase(args[1] || './src');
        console.log('\n📋 Analysis Results:\n', analysis);
        break;
      }

      case 'dev':
        await developmentAssistant();
        break;

      case 'refactor': {
        if (!args[1]) {
          console.error('Please provide a file to refactor');
          process.exit(1);
        }
        await refactorWithHooks(args[1]);
        break;
      }

      case 'background':
        await runBackgroundTasks();
        break;

      case 'secure':
        await secureFileOperations();
        break;

      default:
        console.log('Claude Agent SDK Examples\n');
        console.log('Usage: node example-agent.ts <command> [options]\n');
        console.log('Commands:');
        console.log('  analyze [dir]    - Analyze a codebase');
        console.log('  dev             - Start development assistant');
        console.log('  refactor <file> - Refactor a file with hooks');
        console.log('  background      - Run background tasks');
        console.log('  secure          - Demo secure file operations');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  analyzeCodebase,
  developmentAssistant,
  refactorWithHooks,
  runBackgroundTasks,
  secureFileOperations
};