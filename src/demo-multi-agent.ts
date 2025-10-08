#!/usr/bin/env node
import { CoordinatorAgent } from './agents/coordinator.js';
import { ResearchAgent } from './agents/specialists/research-agent.js';
import { AgentRegistry, ServiceDiscoveryClient } from './server/registry.js';
import { A2AClient } from './a2a/protocol.js';
import { A2AMessage } from './a2a/types.js';

/**
 * Demo: Multi-Agent A2A System
 *
 * This demonstration shows:
 * 1. Starting an agent registry for discovery
 * 2. Launching multiple specialized agents
 * 3. Coordinator agent orchestrating tasks
 * 4. Agents communicating via A2A protocol
 */

// Configuration
const REGISTRY_PORT = 8000;
const COORDINATOR_PORT = 3000;
const RESEARCH_PORT = 3001;

// Store agent instances for cleanup
const agents: any[] = [];
let registry: AgentRegistry | null = null;

/**
 * Start the agent registry service
 */
async function startRegistry(): Promise<void> {
  console.log('\n🌐 Starting Agent Registry...');
  registry = new AgentRegistry(REGISTRY_PORT);
  await registry.start();
  console.log('✅ Registry started successfully');
}

/**
 * Start the research agent
 */
async function startResearchAgent(): Promise<ResearchAgent> {
  console.log('\n🔬 Starting Research Agent...');

  const agent = new ResearchAgent({
    name: 'research-agent',
    description: 'Specialized agent for research and information gathering',
    port: RESEARCH_PORT,
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  await agent.start();
  agents.push(agent);

  // Register with discovery service
  const discoveryClient = new ServiceDiscoveryClient(
    `http://localhost:${REGISTRY_PORT}`,
    'research-agent',
    `http://localhost:${RESEARCH_PORT}`
  );

  await discoveryClient.register();
  console.log('✅ Research Agent started and registered');

  return agent;
}

/**
 * Start the coordinator agent
 */
async function startCoordinatorAgent(): Promise<CoordinatorAgent> {
  console.log('\n🎯 Starting Coordinator Agent...');

  const agent = new CoordinatorAgent({
    name: 'coordinator-agent',
    description: 'Main orchestrator for multi-agent tasks',
    port: COORDINATOR_PORT,
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    registryUrl: `http://localhost:${REGISTRY_PORT}`,
  });

  await agent.start();
  agents.push(agent);

  // Register with discovery service
  const discoveryClient = new ServiceDiscoveryClient(
    `http://localhost:${REGISTRY_PORT}`,
    'coordinator-agent',
    `http://localhost:${COORDINATOR_PORT}`
  );

  await discoveryClient.register();
  console.log('✅ Coordinator Agent started and registered');

  return agent;
}

/**
 * Demonstrate agent-to-agent communication
 */
async function demonstrateA2ACommunication(): Promise<void> {
  console.log('\n📡 Demonstrating A2A Communication...\n');

  // Create a client to interact with the coordinator
  const client = new A2AClient(`http://localhost:${COORDINATOR_PORT}`);

  // Example 1: Simple research task
  console.log('📝 Test 1: Simple Research Task');
  console.log('Request: "Research the A2A protocol and its key features"');

  const researchMessage: A2AMessage = {
    role: 'user',
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    parts: [
      {
        kind: 'text',
        text: 'Research the A2A protocol and its key features',
      },
    ],
    timestamp: new Date().toISOString(),
  };

  const task1 = await client.sendMessage(researchMessage);
  console.log(`Task created: ${task1.id}`);

  // Wait for completion
  await waitForTaskCompletion(client, task1.id);

  // Example 2: Complex multi-step task
  console.log('\n📝 Test 2: Complex Multi-Agent Task');
  console.log('Request: "Research and implement a simple HTTP server with A2A support"');

  const complexMessage: A2AMessage = {
    role: 'user',
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    parts: [
      {
        kind: 'text',
        text: 'Research best practices for HTTP servers and create an implementation plan for an A2A-compatible server',
      },
    ],
    timestamp: new Date().toISOString(),
  };

  const task2 = await client.sendMessage(complexMessage);
  console.log(`Complex task created: ${task2.id}`);

  // Wait for completion
  await waitForTaskCompletion(client, task2.id);

  // Example 3: Direct agent-to-agent communication
  console.log('\n📝 Test 3: Direct Agent Communication');

  const researchClient = new A2AClient(`http://localhost:${RESEARCH_PORT}`);
  const directMessage: A2AMessage = {
    role: 'user',
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    parts: [
      {
        kind: 'text',
        text: 'What are the main components of a microservices architecture?',
      },
    ],
    timestamp: new Date().toISOString(),
  };

  const directTask = await researchClient.sendMessage(directMessage);
  console.log(`Direct research task created: ${directTask.id}`);

  await waitForTaskCompletion(researchClient, directTask.id);
}

/**
 * Wait for task completion with polling
 */
async function waitForTaskCompletion(client: A2AClient, taskId: string): Promise<void> {
  console.log('⏳ Waiting for task completion...');

  for (let i = 0; i < 30; i++) {
    const task = await client.getTask(taskId);

    if (task.status.state === 'completed') {
      console.log('✅ Task completed successfully!');

      // Display results
      const lastMessage = task.messages[task.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        console.log('\n--- Response ---');
        const textParts = lastMessage.parts.filter(p => p.kind === 'text');
        textParts.forEach(part => {
          console.log(part.text);
        });

        const dataParts = lastMessage.parts.filter(p => p.kind === 'data');
        if (dataParts.length > 0) {
          console.log('\n--- Structured Data ---');
          dataParts.forEach(part => {
            console.log(JSON.stringify(part.data, null, 2));
          });
        }
        console.log('----------------\n');
      }

      return;
    }

    if (task.status.state === 'failed') {
      console.error(`❌ Task failed: ${task.error || task.status.message}`);
      return;
    }

    // Show progress
    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n⚠️ Task timeout - did not complete in 30 seconds');
}

/**
 * Show registry statistics
 */
async function showRegistryStats(): Promise<void> {
  console.log('\n📊 Registry Statistics:');

  const response = await fetch(`http://localhost:${REGISTRY_PORT}/stats`);
  if (response.ok) {
    const stats = await response.json();
    console.log(JSON.stringify(stats, null, 2));
  }
}

/**
 * Cleanup function
 */
async function cleanup(): Promise<void> {
  console.log('\n🧹 Cleaning up...');

  // Stop all agents
  for (const agent of agents) {
    await agent.stop();
  }

  // Stop registry
  if (registry) {
    await registry.stop();
  }

  console.log('✅ Cleanup complete');
}

/**
 * Main demonstration function
 */
async function main(): Promise<void> {
  console.log('========================================');
  console.log('   Multi-Agent A2A System Demo');
  console.log('========================================');

  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('\n⚠️  Warning: ANTHROPIC_API_KEY not set');
      console.warn('The agents will run in simulation mode without actual Claude integration.');
      console.warn('Set the environment variable for full functionality.\n');
    }

    // Start services
    await startRegistry();
    await startResearchAgent();
    await startCoordinatorAgent();

    // Wait a moment for services to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Show registry stats
    await showRegistryStats();

    // Run demonstrations
    await demonstrateA2ACommunication();

    // Final stats
    await showRegistryStats();

    console.log('\n✨ Demo completed successfully!');

  } catch (error) {
    console.error('\n❌ Error during demo:', error);
  } finally {
    // Clean up resources
    await cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

// Run the demo
main().catch(console.error);