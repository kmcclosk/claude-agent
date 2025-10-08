import express, { Express } from 'express';
import { Server } from 'http';
import { A2AAgentCard, AgentRegistryEntry } from '../a2a/types.js';
import { A2AClient } from '../a2a/protocol.js';

/**
 * Agent Registry Service
 * Manages agent discovery and health monitoring
 */
export class AgentRegistry {
  private server: Express;
  private httpServer?: Server;
  private agents: Map<string, AgentRegistryEntry> = new Map();
  private port: number;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 8000) {
    this.port = port;
    this.server = express();
    this.setupEndpoints();
  }

  /**
   * Set up registry API endpoints
   */
  private setupEndpoints(): void {
    this.server.use(express.json());

    // Get all registered agents
    this.server.get('/agents', (_req, res) => {
      const agents = Array.from(this.agents.values());
      res.json(agents);
    });

    // Get specific agent by name
    this.server.get('/agents/:name', (req, res) => {
      const agent = this.agents.get(req.params.name);
      if (agent) {
        res.json(agent);
      } else {
        res.status(404).json({ error: 'Agent not found' });
      }
    });

    // Register a new agent
    this.server.post('/agents/register', async (req, res) => {
      try {
        const { name, url } = req.body;

        if (!name || !url) {
          res.status(400).json({ error: 'Name and URL required' });
          return;
        }

        // Fetch agent card from the agent
        const client = new A2AClient(url);
        const agentCard = await client.connect();

        // Create registry entry
        const entry: AgentRegistryEntry = {
          agentCard,
          url,
          status: 'online',
          lastSeen: new Date().toISOString(),
          registeredAt: new Date().toISOString(),
        };

        this.agents.set(name, entry);
        console.log(`Agent registered: ${name} at ${url}`);

        res.json({ success: true, agent: entry });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Unregister an agent
    this.server.delete('/agents/:name', (req, res) => {
      const name = req.params.name;
      if (this.agents.has(name)) {
        this.agents.delete(name);
        console.log(`Agent unregistered: ${name}`);
        res.json({ success: true, message: `Agent ${name} unregistered` });
      } else {
        res.status(404).json({ error: 'Agent not found' });
      }
    });

    // Search agents by capability
    this.server.get('/agents/search/capability/:capability', (req, res) => {
      const capability = req.params.capability.toLowerCase();
      const matching = Array.from(this.agents.values()).filter(entry =>
        entry.agentCard.capabilities.some(cap =>
          cap.toLowerCase().includes(capability)
        )
      );
      res.json(matching);
    });

    // Get agents by status
    this.server.get('/agents/status/:status', (req, res) => {
      const status = req.params.status as 'online' | 'offline' | 'unknown';
      const matching = Array.from(this.agents.values()).filter(entry =>
        entry.status === status
      );
      res.json(matching);
      return;
    });

    // Health check endpoint for the registry itself
    this.server.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        agentsRegistered: this.agents.size,
        uptime: process.uptime(),
      });
    });

    // Get registry statistics
    this.server.get('/stats', (_req, res) => {
      const stats = {
        totalAgents: this.agents.size,
        onlineAgents: Array.from(this.agents.values()).filter(a => a.status === 'online').length,
        offlineAgents: Array.from(this.agents.values()).filter(a => a.status === 'offline').length,
        capabilities: this.getUniqueCapabilities(),
        agentTypes: this.getAgentTypes(),
      };
      res.json(stats);
    });

    // Trigger manual health check
    this.server.post('/agents/health-check', async (_req, res) => {
      await this.performHealthCheck();
      res.json({ success: true, message: 'Health check completed' });
    });
  }

  /**
   * Get unique capabilities across all agents
   */
  private getUniqueCapabilities(): string[] {
    const capabilities = new Set<string>();
    for (const entry of this.agents.values()) {
      entry.agentCard.capabilities.forEach(cap => capabilities.add(cap));
    }
    return Array.from(capabilities);
  }

  /**
   * Get agent types based on names
   */
  private getAgentTypes(): string[] {
    const types = new Set<string>();
    for (const entry of this.agents.values()) {
      const type = entry.agentCard.name.split('-')[0];
      types.add(type);
    }
    return Array.from(types);
  }

  /**
   * Start the registry service
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = this.server.listen(this.port, () => {
        console.log(`Agent Registry running on port ${this.port}`);
        console.log(`Registry API: http://localhost:${this.port}/agents`);

        // Start periodic health checks
        this.startHealthChecks();

        resolve();
      });
    });
  }

  /**
   * Stop the registry service
   */
  public async stop(): Promise<void> {
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => {
          console.log('Agent Registry stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Start periodic health checks for registered agents
   */
  private startHealthChecks(): void {
    // Run health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('Health check error:', error);
      });
    }, 30000);

    // Run initial health check
    this.performHealthCheck();
  }

  /**
   * Perform health check on all registered agents
   */
  private async performHealthCheck(): Promise<void> {
    console.log('Performing health check on all agents...');

    const checks = Array.from(this.agents.entries()).map(async ([name, entry]) => {
      try {
        const client = new A2AClient(entry.url);
        const isAlive = await client.ping();

        if (isAlive) {
          entry.status = 'online';
          entry.lastSeen = new Date().toISOString();
        } else {
          entry.status = 'offline';
        }
      } catch (error) {
        entry.status = 'offline';
        console.warn(`Agent ${name} is offline`);
      }
    });

    await Promise.all(checks);

    const online = Array.from(this.agents.values()).filter(a => a.status === 'online').length;
    const offline = Array.from(this.agents.values()).filter(a => a.status === 'offline').length;

    console.log(`Health check complete: ${online} online, ${offline} offline`);
  }

  /**
   * Register an agent directly (for testing)
   */
  public registerAgent(name: string, url: string, agentCard: A2AAgentCard): void {
    const entry: AgentRegistryEntry = {
      agentCard,
      url,
      status: 'online',
      lastSeen: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
    };

    this.agents.set(name, entry);
    console.log(`Agent registered directly: ${name}`);
  }

  /**
   * Get registry information
   */
  public getInfo(): any {
    return {
      port: this.port,
      agentsRegistered: this.agents.size,
      agents: Array.from(this.agents.keys()),
      capabilities: this.getUniqueCapabilities(),
    };
  }
}

/**
 * Service Discovery Client
 * Used by agents to register themselves and discover other agents
 */
export class ServiceDiscoveryClient {
  private registryUrl: string;
  private agentName: string;
  private agentUrl: string;
  private registered: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(registryUrl: string, agentName: string, agentUrl: string) {
    this.registryUrl = registryUrl;
    this.agentName = agentName;
    this.agentUrl = agentUrl;
  }

  /**
   * Register with the registry
   */
  public async register(): Promise<void> {
    try {
      const response = await fetch(`${this.registryUrl}/agents/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.agentName,
          url: this.agentUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
      }

      this.registered = true;
      console.log(`Registered with registry at ${this.registryUrl}`);

      // Start heartbeat
      this.startHeartbeat();
    } catch (error) {
      console.error('Failed to register with registry:', error);
      throw error;
    }
  }

  /**
   * Unregister from the registry
   */
  public async unregister(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (!this.registered) {
      return;
    }

    try {
      const response = await fetch(`${this.registryUrl}/agents/${this.agentName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Unregistration failed: ${response.status}`);
      }

      this.registered = false;
      console.log('Unregistered from registry');
    } catch (error) {
      console.error('Failed to unregister from registry:', error);
    }
  }

  /**
   * Discover agents with specific capability
   */
  public async discoverByCapability(capability: string): Promise<AgentRegistryEntry[]> {
    try {
      const response = await fetch(
        `${this.registryUrl}/agents/search/capability/${capability}`
      );

      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.status}`);
      }

      return await response.json() as AgentRegistryEntry[];
    } catch (error) {
      console.error('Failed to discover agents:', error);
      return [];
    }
  }

  /**
   * Get all registered agents
   */
  public async getAllAgents(): Promise<AgentRegistryEntry[]> {
    try {
      const response = await fetch(`${this.registryUrl}/agents`);

      if (!response.ok) {
        throw new Error(`Failed to get agents: ${response.status}`);
      }

      return await response.json() as AgentRegistryEntry[];
    } catch (error) {
      console.error('Failed to get agents:', error);
      return [];
    }
  }

  /**
   * Start periodic heartbeat to maintain registration
   */
  private startHeartbeat(): void {
    // Send heartbeat every 20 seconds
    this.heartbeatInterval = setInterval(() => {
      // Re-register to update lastSeen
      this.register().catch(error => {
        console.error('Heartbeat failed:', error);
      });
    }, 20000);
  }
}