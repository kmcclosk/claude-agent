#!/usr/bin/env node

// Interactive Agent Example: Steering and Intervening in Claude Agent SDK
// This demonstrates all the ways you can control an agent during execution

import {
  query,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
  type SDKAssistantMessage,
  type SDKResultMessage,
  type SDKSystemMessage,
  type PermissionResult,
  type PermissionMode,
  type HookInput,
  type HookJSONOutput,
  type Options,
  type CanUseTool
} from '@anthropic-ai/claude-agent-sdk';
import readline from 'readline';

// Type definitions
interface MessageQueueItem extends SDKUserMessage {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
  parent_tool_use_id: string | null;
  session_id: string;
}

interface PermissionState {
  allowWrites: boolean;
  allowReads: boolean;
  allowCommands: boolean;
  requireConfirmation: boolean;
}

interface EventLogEntry {
  type: 'tool_use' | 'milestone' | 'log';
  message?: string;
  tool?: string;
  description?: string;
  time: number;
}

interface InteractiveAgentOptions {
  initialPrompt?: string;
  requireConfirmation?: boolean;
}

// ============================================================================
// 1. BIDIRECTIONAL STREAMING COMMUNICATION
// ============================================================================

/**
 * Creates an interactive message stream that allows sending messages
 * to the agent while it's running
 */
class InteractiveMessageStream {
  private messageQueue: MessageQueueItem[] = [];
  private shouldContinue: boolean = true;
  private sessionId: string;
  private initialPrompt: string;

  constructor(initialPrompt: string) {
    this.sessionId = `session-${Date.now()}`;
    this.initialPrompt = initialPrompt;
  }

  async *generate(): AsyncGenerator<SDKUserMessage> {
    // Send initial prompt
    yield {
      type: 'user',
      message: {
        role: 'user',
        content: this.initialPrompt
      },
      parent_tool_use_id: null,
      session_id: this.sessionId
    };

    // Continue streaming messages from queue
    while (this.shouldContinue) {
      // Wait for new messages
      while (this.messageQueue.length === 0 && this.shouldContinue) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (this.messageQueue.length > 0) {
        yield this.messageQueue.shift()!;
      }
    }
  }

  sendMessage(content: string): void {
    this.messageQueue.push({
      type: 'user',
      message: {
        role: 'user',
        content
      },
      parent_tool_use_id: null,
      session_id: this.sessionId
    });
  }

  stop(): void {
    this.shouldContinue = false;
  }
}

// ============================================================================
// 2. INTERACTIVE AGENT WITH FULL CONTROL
// ============================================================================

class InteractiveAgent {
  private messageStream: InteractiveMessageStream;
  private abortController: AbortController;
  private permissionState: PermissionState;
  private eventLog: EventLogEntry[] = [];
  private agent: Query | null = null;
  private processorPromise: Promise<void> | null = null;
  private shouldPause: boolean = false;

  constructor(options: InteractiveAgentOptions = {}) {
    this.messageStream = new InteractiveMessageStream(
      options.initialPrompt || "Hello! I'm ready to help."
    );

    this.abortController = new AbortController();
    this.permissionState = {
      allowWrites: true,
      allowReads: true,
      allowCommands: true,
      requireConfirmation: options.requireConfirmation || false
    };
  }

  /**
   * Start the interactive agent
   */
  async start(): Promise<InteractiveAgent> {
    console.log('🚀 Starting Interactive Agent\n');

    const options: Options = {
      // Enable streaming for real-time control
      includePartialMessages: true,

      // Abort controller for external cancellation
      abortController: this.abortController,

      // Dynamic permission callback
      canUseTool: this.createPermissionHandler(),

      // Hook system for intervention
      hooks: this.createHooks(),

      // Initial settings
      model: 'sonnet',
      permissionMode: 'default' as PermissionMode,
      maxTurns: 50
    };

    this.agent = query({
      prompt: this.messageStream.generate(),
      options
    });

    // Start processing agent messages in background
    this.processorPromise = this.processAgentMessages();

    return this;
  }

  /**
   * Create dynamic permission handler
   */
  private createPermissionHandler(): CanUseTool {
    return async (toolName: string, input: Record<string, unknown>, { signal, suggestions }) => {
      this.log(`Permission check: ${toolName}`);

      // Check global permission state
      if (toolName === 'FileWrite' && !this.permissionState.allowWrites) {
        return {
          behavior: 'deny',
          message: 'File writes are currently disabled',
          interrupt: false
        } as PermissionResult;
      }

      if (toolName === 'Bash' && !this.permissionState.allowCommands) {
        return {
          behavior: 'deny',
          message: 'Command execution is currently disabled',
          interrupt: false
        } as PermissionResult;
      }

      // Interactive confirmation for destructive operations
      if (this.permissionState.requireConfirmation) {
        const destructiveTools = ['FileWrite', 'FileEdit', 'Bash'];

        if (destructiveTools.includes(toolName)) {
          console.log(`\n⚠️  Agent wants to use: ${toolName}`);
          console.log(`   Details: ${JSON.stringify(input).slice(0, 100)}...`);

          const approved = await this.getUserConfirmation();

          if (!approved) {
            return {
              behavior: 'deny',
              message: 'User rejected this operation',
              interrupt: false
            } as PermissionResult;
          }
        }
      }

      return {
        behavior: 'allow',
        updatedInput: input,
        updatedPermissions: suggestions
      } as PermissionResult;
    };
  }

  /**
   * Create intervention hooks
   */
  private createHooks(): Options['hooks'] {
    return {
      PreToolUse: [{
        hooks: [async (input: HookInput, toolUseId: string | undefined, { signal }): Promise<HookJSONOutput> => {
          if (input.hook_event_name !== 'PreToolUse') {
            return { continue: true };
          }

          this.log(`PreToolUse: ${input.tool_name}`);

          // Example: Pause execution based on external condition
          if (this.shouldPause) {
            console.log('⏸️  Execution paused by user');
            return {
              continue: false,
              stopReason: 'User requested pause'
            };
          }

          // Example: Inject additional context
          if (input.tool_name === 'FileRead') {
            return {
              continue: true,
              systemMessage: 'Pay attention to error handling patterns'
            };
          }

          return { continue: true };
        }]
      }],

      PostToolUse: [{
        hooks: [async (input: HookInput, toolUseId: string | undefined, { signal }): Promise<HookJSONOutput> => {
          if (input.hook_event_name !== 'PostToolUse') {
            return { continue: true };
          }

          this.log(`PostToolUse: ${input.tool_name}`);

          // Example: React to tool results
          const postToolInput = input as any;
          if (input.tool_name === 'Bash' && postToolInput.tool_response?.exitCode !== 0) {
            console.log('❌ Command failed, sending guidance to agent');
            this.messageStream.sendMessage(
              'The command failed. Please check the error and try a different approach.'
            );
          }

          return { continue: true };
        }]
      }],

      UserPromptSubmit: [{
        hooks: [async (input: HookInput): Promise<HookJSONOutput> => {
          if (input.hook_event_name !== 'UserPromptSubmit') {
            return { continue: true };
          }

          this.log(`UserPromptSubmit: ${input.prompt.slice(0, 50)}...`);

          // Example: Enhance user prompts with context
          const additionalContext = this.getContextForPrompt(input.prompt);
          if (additionalContext) {
            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: 'UserPromptSubmit',
                additionalContext
              }
            };
          }

          return { continue: true };
        }]
      }]
    };
  }

  /**
   * Process agent messages
   */
  private async processAgentMessages(): Promise<void> {
    if (!this.agent) return;

    try {
      for await (const message of this.agent) {
        switch (message.type) {
          case 'system':
            this.handleSystemMessage(message as SDKSystemMessage);
            break;

          case 'assistant':
            this.handleAssistantMessage(message as SDKAssistantMessage);
            break;

          case 'result':
            this.handleResultMessage(message as SDKResultMessage);
            break;

          case 'stream_event':
            // Handle streaming events for real-time updates
            if ('event' in message && message.event.type === 'content_block_delta') {
              // Could show typing indicator or partial results
            }
            break;
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('🛑 Agent execution aborted');
      } else {
        console.error('❌ Error:', error);
      }
    }
  }

  private handleSystemMessage(message: SDKSystemMessage): void {
    if (message.subtype === 'init') {
      console.log('✅ Agent initialized');
      console.log(`   Model: ${message.model}`);
      console.log(`   Tools: ${message.tools.slice(0, 5).join(', ')}...`);
      console.log(`   Permission mode: ${message.permissionMode}\n`);
    }
  }

  private handleAssistantMessage(message: SDKAssistantMessage): void {
    const textContent = message.message.content
      .filter(c => c.type === 'text')
      .map(c => 'text' in c ? c.text : '')
      .join('\n');

    if (textContent) {
      console.log('💬 Agent:', textContent, '\n');
      this.handleAgentResponse(textContent);
    }

    // Log tool usage
    const toolUses = message.message.content.filter(c => c.type === 'tool_use');
    for (const tool of toolUses) {
      if ('name' in tool) {
        console.log(`🔧 Tool used: ${tool.name}`);
        this.eventLog.push({
          type: 'tool_use',
          tool: tool.name,
          time: Date.now()
        });
      }
    }
  }

  private handleResultMessage(message: SDKResultMessage): void {
    console.log('\n📊 Execution Summary:');
    console.log(`   Status: ${message.subtype}`);
    console.log(`   Duration: ${message.duration_ms}ms`);
    console.log(`   Turns: ${message.num_turns}`);
    console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
    console.log(`   Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

    if (message.permission_denials?.length > 0) {
      console.log(`   ❌ Permission denials: ${message.permission_denials.length}`);
      for (const denial of message.permission_denials) {
        console.log(`      - ${denial.tool_name}: ${JSON.stringify(denial.tool_input)}`);
      }
    }
  }

  /**
   * Handle agent responses and potentially steer the conversation
   */
  private handleAgentResponse(text: string): void {
    // Example: Detect when agent needs clarification and provide it
    if (text.toLowerCase().includes('need more information') ||
        text.toLowerCase().includes('could you clarify')) {
      console.log('🤔 Agent needs clarification, providing context...\n');
      this.messageStream.sendMessage(
        'Focus on the authentication module in the src/auth directory'
      );
    }

    // Example: Detect completion of a phase and guide next steps
    if (text.toLowerCase().includes('completed') ||
        text.toLowerCase().includes('finished')) {
      this.eventLog.push({
        type: 'milestone',
        description: 'Task phase completed',
        time: Date.now()
      });
    }
  }

  /**
   * Get additional context based on the prompt
   */
  private getContextForPrompt(prompt: string): string | null {
    if (prompt.toLowerCase().includes('test')) {
      return 'Use Jest for testing and ensure 80% code coverage';
    }
    if (prompt.toLowerCase().includes('security')) {
      return 'Follow OWASP guidelines and check for common vulnerabilities';
    }
    return null;
  }

  /**
   * Interactive user confirmation
   */
  private async getUserConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('   Allow this operation? (y/n): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }

  /**
   * Log events
   */
  private log(message: string): void {
    this.eventLog.push({
      type: 'log',
      message,
      time: Date.now()
    });
  }

  // ============================================================================
  // CONTROL METHODS - These can be called anytime during execution
  // ============================================================================

  /**
   * Send a message to the agent
   */
  sendMessage(content: string): void {
    console.log(`📤 Sending: ${content}\n`);
    this.messageStream.sendMessage(content);
  }

  /**
   * Interrupt the agent immediately
   */
  async interrupt(): Promise<void> {
    console.log('🛑 Interrupting agent...');
    if (this.agent) {
      await this.agent.interrupt();
    }
  }

  /**
   * Change the model being used
   */
  async changeModel(model: string): Promise<void> {
    console.log(`🔄 Switching to model: ${model}`);
    if (this.agent) {
      await this.agent.setModel(model);
    }
  }

  /**
   * Change permission mode
   */
  async changePermissionMode(mode: PermissionMode): Promise<void> {
    console.log(`🔐 Changing permission mode to: ${mode}`);
    if (this.agent) {
      await this.agent.setPermissionMode(mode);
    }
  }

  /**
   * Abort the agent completely
   */
  abort(): void {
    console.log('❌ Aborting agent execution');
    this.abortController.abort();
  }

  /**
   * Pause execution (via hook)
   */
  pause(): void {
    console.log('⏸️  Pausing agent');
    this.shouldPause = true;
  }

  /**
   * Resume execution
   */
  resume(): void {
    console.log('▶️  Resuming agent');
    this.shouldPause = false;
  }

  /**
   * Update permission state
   */
  setPermissions(permissions: Partial<PermissionState>): void {
    Object.assign(this.permissionState, permissions);
    console.log(`🔐 Updated permissions:`, this.permissionState);
  }

  /**
   * Get execution history
   */
  getHistory(): EventLogEntry[] {
    return this.eventLog;
  }

  /**
   * Stop the agent gracefully
   */
  async stop(): Promise<void> {
    console.log('🏁 Stopping agent...');
    this.messageStream.stop();
    if (this.agent) {
      await this.agent.interrupt();
    }
    if (this.processorPromise) {
      await this.processorPromise;
    }
  }
}

// ============================================================================
// 3. DEMONSTRATION SCRIPT
// ============================================================================

async function demonstrateInteractiveControl(): Promise<void> {
  console.log('=' .repeat(60));
  console.log('Interactive Agent Control Demonstration');
  console.log('=' .repeat(60));
  console.log('\nThis demo shows how to steer and intervene in agent execution.\n');

  // Create and start the interactive agent
  const agent = new InteractiveAgent({
    initialPrompt: "Hi! I'm ready to help. What would you like me to do?",
    requireConfirmation: true
  });

  await agent.start();

  // Demonstrate various control mechanisms
  console.log('\n📋 Available Controls:');
  console.log('  1. Send follow-up messages');
  console.log('  2. Change model (opus/sonnet/haiku)');
  console.log('  3. Change permissions');
  console.log('  4. Interrupt execution');
  console.log('  5. Pause/Resume');
  console.log('  6. Abort completely\n');

  // Example: Send initial task
  setTimeout(() => {
    agent.sendMessage("Please analyze the current directory structure");
  }, 1000);

  // Example: Change model after 5 seconds
  setTimeout(() => {
    console.log('\n🔄 Demo: Switching to Opus model for complex reasoning...\n');
    agent.changeModel('opus');
  }, 5000);

  // Example: Restrict permissions after 10 seconds
  setTimeout(() => {
    console.log('\n🔐 Demo: Disabling file writes for safety...\n');
    agent.setPermissions({ allowWrites: false });
  }, 10000);

  // Example: Send clarification after 15 seconds
  setTimeout(() => {
    console.log('\n💬 Demo: Providing additional guidance...\n');
    agent.sendMessage("Focus only on JavaScript and TypeScript files");
  }, 15000);

  // Stop after 30 seconds
  setTimeout(async () => {
    console.log('\n⏰ Demo: Time limit reached, stopping agent...\n');
    await agent.stop();

    // Show execution history
    console.log('\n📜 Execution History:');
    const history = agent.getHistory();
    const toolUses = history.filter(e => e.type === 'tool_use');
    console.log(`  Total events: ${history.length}`);
    console.log(`  Tool uses: ${toolUses.length}`);
    console.log(`  Tools used: ${[...new Set(toolUses.map(t => t.tool))].join(', ')}`);

    process.exit(0);
  }, 30000);
}

// ============================================================================
// 4. INTERACTIVE CLI
// ============================================================================

async function interactiveCLI(): Promise<void> {
  console.log('🎮 Interactive Agent CLI\n');
  console.log('Commands:');
  console.log('  /msg <text>    - Send message to agent');
  console.log('  /model <name>  - Change model (opus/sonnet/haiku)');
  console.log('  /perm <type>   - Toggle permission (writes/reads/commands)');
  console.log('  /interrupt     - Interrupt current execution');
  console.log('  /pause         - Pause execution');
  console.log('  /resume        - Resume execution');
  console.log('  /history       - Show execution history');
  console.log('  /stop          - Stop and exit');
  console.log('  /help          - Show this help\n');

  const agent = new InteractiveAgent({
    initialPrompt: "Hello! I'm your interactive assistant. How can I help?",
    requireConfirmation: false
  });

  await agent.start();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const processCommand = async (input: string): Promise<void> => {
    const [command, ...args] = input.split(' ');
    const arg = args.join(' ');

    switch (command) {
      case '/msg':
        agent.sendMessage(arg);
        break;

      case '/model':
        await agent.changeModel(arg);
        break;

      case '/perm':
        const perms: Partial<PermissionState> = {};
        if (arg === 'writes') perms.allowWrites = !agent['permissionState'].allowWrites;
        if (arg === 'reads') perms.allowReads = !agent['permissionState'].allowReads;
        if (arg === 'commands') perms.allowCommands = !agent['permissionState'].allowCommands;
        agent.setPermissions(perms);
        break;

      case '/interrupt':
        await agent.interrupt();
        break;

      case '/pause':
        agent.pause();
        break;

      case '/resume':
        agent.resume();
        break;

      case '/history':
        console.log('📜 History:', agent.getHistory());
        break;

      case '/stop':
        await agent.stop();
        process.exit(0);
        break;

      case '/help':
        console.log('See commands above');
        break;

      default:
        // Send as message if not a command
        if (!input.startsWith('/')) {
          agent.sendMessage(input);
        }
    }
  };

  rl.on('line', processCommand);
}

// ============================================================================
// 5. MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0];

  try {
    switch (mode) {
      case 'demo':
        await demonstrateInteractiveControl();
        break;

      case 'cli':
        await interactiveCLI();
        break;

      default:
        console.log('Interactive Agent Examples\n');
        console.log('Usage: node interactive-agent.ts <mode>\n');
        console.log('Modes:');
        console.log('  demo  - Automated demonstration of control features');
        console.log('  cli   - Interactive command-line interface');
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

// Export for use in other modules
export { InteractiveAgent, InteractiveMessageStream };