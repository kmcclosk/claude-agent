import { BaseA2AAgent, BaseA2AAgentOptions } from './base-agent.js';
import { A2AClient } from '../a2a/protocol.js';
import { A2AMessage, AgentRegistryEntry } from '../a2a/types.js';

export interface CoordinatorOptions extends BaseA2AAgentOptions {
  registryUrl?: string;
}

interface TaskDecomposition {
  mainGoal: string;
  subtasks: Array<{
    id: string;
    description: string;
    requiredCapabilities: string[];
    dependencies: string[];
    assignedAgent?: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
    result?: any;
  }>;
}

/**
 * Coordinator Agent - Orchestrates tasks across multiple specialized agents
 */
export class CoordinatorAgent extends BaseA2AAgent {
  private registryUrl: string;
  private knownAgents: Map<string, AgentRegistryEntry> = new Map();
  private agentClients: Map<string, A2AClient> = new Map();
  private taskDecompositions: Map<string, TaskDecomposition> = new Map();

  constructor(options: CoordinatorOptions) {
    super({
      ...options,
      capabilities: [
        'task_orchestration',
        'agent_discovery',
        'task_decomposition',
        'result_synthesis',
        'workflow_management',
        ...(options.capabilities || [])
      ],
    });

    this.registryUrl = options.registryUrl || 'http://localhost:8000';

    // Set up specialized system prompt for coordination
    this.setupSystemPrompt();
  }

  /**
   * Configure the Claude agent with coordination capabilities
   */
  private setupSystemPrompt(): void {
    // System prompt would be configured here for Claude integration
    const _systemPrompt = `You are a Coordinator Agent in a multi-agent A2A system. Your role is to:

1. Analyze complex tasks and break them down into subtasks
2. Identify which specialized agents are best suited for each subtask
3. Delegate work to appropriate agents based on their capabilities
4. Monitor task progress and handle failures
5. Synthesize results from multiple agents into coherent responses

When decomposing tasks:
- Identify the main goal
- Break it into logical, independent subtasks when possible
- Consider dependencies between subtasks
- Match required capabilities to available agents

Available agent types you can delegate to:
- Research Agent: Information gathering, web search, documentation analysis
- Code Agent: Code generation, review, refactoring, debugging
- Data Agent: Data processing, analysis, visualization
- QA Agent: Testing, validation, quality checks

Always provide clear, specific instructions to delegated agents.`;

    // In a real implementation, this would configure the Claude agent
    console.log('Coordinator system prompt configured');
  }

  /**
   * Process incoming task with orchestration
   */
  protected async processTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = {
      state: 'working',
      message: 'Orchestrating multi-agent task'
    };

    try {
      // Extract the user's request
      const lastMessage = task.messages[task.messages.length - 1];
      const userRequest = this.extractTextFromMessage(lastMessage);

      // Decompose the task
      const decomposition = await this.decomposeTask(userRequest);
      this.taskDecompositions.set(taskId, decomposition);

      // Discover available agents
      await this.discoverAgents();

      // Assign subtasks to agents
      await this.assignSubtasks(decomposition);

      // Execute subtasks (with dependency management)
      const results = await this.executeSubtasks(decomposition);

      // Synthesize results
      const finalResponse = await this.synthesizeResults(decomposition, results);

      // Create response message (per A2A specification)
      const responseMessage: A2AMessage = {
        role: 'assistant',
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parts: [
          {
            kind: 'text',
            text: finalResponse,
          },
          {
            kind: 'data',
            data: {
              decomposition: decomposition,
              agentResults: results,
            },
          },
        ],
        timestamp: new Date().toISOString(),
      };

      task.messages.push(responseMessage);
      task.status = {
        state: 'completed',
        message: 'Task orchestration completed successfully'
      };
      task.completedAt = new Date().toISOString();

      this.emit('task:completed', task);
    } catch (error: any) {
      task.status = {
        state: 'failed',
        message: error.message
      };
      task.error = error.message;
      this.emit('task:failed', task, error);
    }
  }

  /**
   * Decompose a complex task into subtasks
   */
  private async decomposeTask(userRequest: string): Promise<TaskDecomposition> {
    // In a real implementation, this would use Claude to analyze the request
    // For now, we'll create a simple decomposition

    console.log(`Decomposing task: ${userRequest}`);

    // Example decomposition logic
    const decomposition: TaskDecomposition = {
      mainGoal: userRequest,
      subtasks: [],
    };

    // Analyze request for different aspects
    if (userRequest.toLowerCase().includes('research') ||
        userRequest.toLowerCase().includes('find') ||
        userRequest.toLowerCase().includes('search')) {
      decomposition.subtasks.push({
        id: `subtask_${Date.now()}_1`,
        description: `Research and gather information about: ${userRequest}`,
        requiredCapabilities: ['research', 'web_search'],
        dependencies: [],
        status: 'pending',
      });
    }

    if (userRequest.toLowerCase().includes('code') ||
        userRequest.toLowerCase().includes('implement') ||
        userRequest.toLowerCase().includes('function')) {
      const researchTaskId = decomposition.subtasks.find(t =>
        t.requiredCapabilities.includes('research'))?.id;

      decomposition.subtasks.push({
        id: `subtask_${Date.now()}_2`,
        description: `Generate code implementation for: ${userRequest}`,
        requiredCapabilities: ['code_generation', 'programming'],
        dependencies: researchTaskId ? [researchTaskId] : [],
        status: 'pending',
      });
    }

    if (userRequest.toLowerCase().includes('test') ||
        userRequest.toLowerCase().includes('validate')) {
      const codeTaskId = decomposition.subtasks.find(t =>
        t.requiredCapabilities.includes('code_generation'))?.id;

      decomposition.subtasks.push({
        id: `subtask_${Date.now()}_3`,
        description: `Test and validate implementation: ${userRequest}`,
        requiredCapabilities: ['testing', 'validation'],
        dependencies: codeTaskId ? [codeTaskId] : [],
        status: 'pending',
      });
    }

    // If no specific subtasks identified, create a general one
    if (decomposition.subtasks.length === 0) {
      decomposition.subtasks.push({
        id: `subtask_${Date.now()}_general`,
        description: userRequest,
        requiredCapabilities: ['general'],
        dependencies: [],
        status: 'pending',
      });
    }

    return decomposition;
  }

  /**
   * Discover available agents from registry
   */
  private async discoverAgents(): Promise<void> {
    try {
      const response = await fetch(`${this.registryUrl}/agents`);
      if (response.ok) {
        const agents = await response.json() as AgentRegistryEntry[];

        for (const entry of agents) {
          this.knownAgents.set(entry.agentCard.name, entry);

          // Create client for each agent
          if (!this.agentClients.has(entry.agentCard.name)) {
            const client = new A2AClient(entry.url);
            this.agentClients.set(entry.agentCard.name, client);
          }
        }

        console.log(`Discovered ${agents.length} agents`);
      }
    } catch (error) {
      console.warn('Failed to discover agents from registry:', error);

      // Fall back to known default agents
      this.setupDefaultAgents();
    }
  }

  /**
   * Set up connections to default agents
   */
  private setupDefaultAgents(): void {
    const defaultAgents = [
      { name: 'research-agent', url: 'http://localhost:3001', capabilities: ['research', 'web_search'] },
      { name: 'code-agent', url: 'http://localhost:3002', capabilities: ['code_generation', 'programming'] },
      { name: 'data-agent', url: 'http://localhost:3003', capabilities: ['data_processing', 'analysis'] },
      { name: 'qa-agent', url: 'http://localhost:3004', capabilities: ['testing', 'validation'] },
    ];

    for (const agent of defaultAgents) {
      if (!this.agentClients.has(agent.name)) {
        const client = new A2AClient(agent.url);
        this.agentClients.set(agent.name, client);
      }
    }
  }

  /**
   * Assign subtasks to appropriate agents
   */
  private async assignSubtasks(decomposition: TaskDecomposition): Promise<void> {
    for (const subtask of decomposition.subtasks) {
      // Find best matching agent based on capabilities
      let bestAgent: string | null = null;
      let bestScore = 0;

      for (const [agentName, entry] of this.knownAgents.entries()) {
        const capabilities = entry.agentCard.capabilities;
        const score = this.calculateCapabilityMatch(
          subtask.requiredCapabilities,
          capabilities
        );

        if (score > bestScore) {
          bestScore = score;
          bestAgent = agentName;
        }
      }

      // Fall back to capability-based assignment if no registry
      if (!bestAgent) {
        bestAgent = this.selectAgentByCapability(subtask.requiredCapabilities);
      }

      if (bestAgent) {
        subtask.assignedAgent = bestAgent;
        subtask.status = 'assigned';
        console.log(`Assigned subtask ${subtask.id} to ${bestAgent}`);
      } else {
        console.warn(`No suitable agent found for subtask ${subtask.id}`);
      }
    }
  }

  /**
   * Calculate capability match score
   */
  private calculateCapabilityMatch(required: string[], available: string[]): number {
    let matches = 0;
    for (const req of required) {
      if (available.some(cap => cap.toLowerCase().includes(req.toLowerCase()))) {
        matches++;
      }
    }
    return matches / required.length;
  }

  /**
   * Select agent based on required capabilities
   */
  private selectAgentByCapability(capabilities: string[]): string {
    const capabilityMap: Record<string, string> = {
      'research': 'research-agent',
      'web_search': 'research-agent',
      'code_generation': 'code-agent',
      'programming': 'code-agent',
      'data_processing': 'data-agent',
      'analysis': 'data-agent',
      'testing': 'qa-agent',
      'validation': 'qa-agent',
      'general': 'research-agent', // Default fallback
    };

    for (const cap of capabilities) {
      if (capabilityMap[cap]) {
        return capabilityMap[cap];
      }
    }

    return 'research-agent'; // Default
  }

  /**
   * Execute subtasks with dependency management
   */
  private async executeSubtasks(decomposition: TaskDecomposition): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const completed = new Set<string>();

    // Execute tasks in dependency order
    while (completed.size < decomposition.subtasks.length) {
      const readyTasks = decomposition.subtasks.filter(task =>
        task.status !== 'completed' &&
        task.status !== 'in_progress' &&
        task.dependencies.every(dep => completed.has(dep))
      );

      if (readyTasks.length === 0 && completed.size < decomposition.subtasks.length) {
        throw new Error('Deadlock detected in task dependencies');
      }

      // Execute ready tasks in parallel
      const executions = readyTasks.map(async (subtask) => {
        subtask.status = 'in_progress';

        try {
          if (!subtask.assignedAgent) {
            throw new Error(`No agent assigned for subtask ${subtask.id}`);
          }

          const client = this.agentClients.get(subtask.assignedAgent);
          if (!client) {
            throw new Error(`No client available for agent ${subtask.assignedAgent}`);
          }

          // Prepare context from dependencies
          const context = this.prepareContext(subtask, results);

          // Create task on remote agent (per A2A specification)
          const message: A2AMessage = {
            role: 'user',
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            parts: [
              {
                kind: 'text',
                text: subtask.description,
              },
              {
                kind: 'data',
                data: context,
              },
            ],
            timestamp: new Date().toISOString(),
          };

          const remoteTask = await client.sendMessage(message, {
            parentTask: subtask.id,
            coordinator: this.name,
          });

          // Poll for completion
          const result = await this.pollTaskCompletion(client, remoteTask.id);

          results.set(subtask.id, result);
          completed.add(subtask.id);
          subtask.status = 'completed';
          subtask.result = result;

          return result;
        } catch (error: any) {
          subtask.status = 'failed';
          console.error(`Subtask ${subtask.id} failed:`, error);
          throw error;
        }
      });

      await Promise.all(executions);
    }

    return results;
  }

  /**
   * Prepare context for a subtask from dependency results
   */
  private prepareContext(subtask: any, results: Map<string, any>): any {
    const context: any = {};

    for (const depId of subtask.dependencies) {
      const depResult = results.get(depId);
      if (depResult) {
        context[depId] = depResult;
      }
    }

    return context;
  }

  /**
   * Poll remote task until completion
   */
  private async pollTaskCompletion(client: A2AClient, taskId: string, maxAttempts = 30): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const task = await client.getTask(taskId);

      if (task.status.state === 'completed') {
        // Extract result from last message
        const lastMessage = task.messages[task.messages.length - 1];
        return this.extractResultFromMessage(lastMessage);
      }

      if (task.status.state === 'failed') {
        throw new Error(`Remote task failed: ${task.error || task.status.message}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Task polling timeout');
  }

  /**
   * Extract result from A2A message (per specification)
   */
  private extractResultFromMessage(message: A2AMessage): any {
    // Look for data parts first
    const dataPart = message.parts.find(p => p.kind === 'data');
    if (dataPart) {
      return dataPart.data;
    }

    // Fall back to text
    const textParts = message.parts.filter(p => p.kind === 'text');
    if (textParts.length > 0) {
      return textParts.map(p => p.text || '').join('\n');
    }

    return null;
  }

  /**
   * Synthesize results from multiple agents
   */
  private async synthesizeResults(decomposition: TaskDecomposition, results: Map<string, any>): Promise<string> {
    // In a real implementation, this would use Claude to synthesize
    // For now, we'll create a structured summary

    let synthesis = `Task completed successfully.\n\n`;
    synthesis += `Main Goal: ${decomposition.mainGoal}\n\n`;
    synthesis += `Results from specialized agents:\n`;

    for (const subtask of decomposition.subtasks) {
      const result = results.get(subtask.id);
      synthesis += `\n### ${subtask.description}\n`;
      synthesis += `Agent: ${subtask.assignedAgent}\n`;
      synthesis += `Status: ${subtask.status}\n`;

      if (result) {
        if (typeof result === 'string') {
          synthesis += `Result: ${result}\n`;
        } else {
          synthesis += `Result: ${JSON.stringify(result, null, 2)}\n`;
        }
      }
    }

    return synthesis;
  }

  /**
   * Get task decomposition for a specific task
   */
  public getTaskDecomposition(taskId: string): TaskDecomposition | undefined {
    return this.taskDecompositions.get(taskId);
  }

  /**
   * Get list of known agents
   */
  public getKnownAgents(): AgentRegistryEntry[] {
    return Array.from(this.knownAgents.values());
  }
}

// Main execution for running as standalone server
async function main() {
  console.log('🤖 Starting Coordinator Agent...\n');

  const coordinator = new CoordinatorAgent({
    name: 'CoordinatorAgent',
    description: 'Orchestrates complex tasks across multiple specialized agents',
    port: 3000,
    capabilities: [
      'task-decomposition',
      'agent-orchestration',
      'multi-agent-coordination',
      'result-synthesis'
    ],
    version: '1.0.0',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4',
    registryUrl: 'http://localhost:3100'
  });

  await coordinator.start();

  console.log('\n✅ Coordinator Agent is ready!');
  console.log('   - Agent Card: http://localhost:3000/.well-known/agent.json');
  console.log('   - RPC Endpoint: http://localhost:3000/rpc');
  console.log('   - Registry URL: http://localhost:3100\n');

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down Coordinator Agent...');
    await coordinator.stop();
    process.exit(0);
  });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error starting Coordinator Agent:', error);
    process.exit(1);
  });
}