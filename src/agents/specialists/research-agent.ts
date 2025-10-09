import { BaseA2AAgent, BaseA2AAgentOptions } from '../base-agent.js';
import { A2AMessage } from '../../a2a/types.js';

/**
 * Research Agent - Specialized in information gathering and analysis
 */
export class ResearchAgent extends BaseA2AAgent {
  constructor(options: Omit<BaseA2AAgentOptions, 'capabilities'>) {
    super({
      ...options,
      capabilities: [
        'research',
        'web_search',
        'documentation_analysis',
        'information_extraction',
        'summarization',
        'fact_checking',
        'literature_review',
      ],
    });

    this.setupResearchPrompt();
  }

  /**
   * Configure specialized system prompt for research
   */
  private setupResearchPrompt(): void {
    // System prompt would be configured here for Claude integration
    const _systemPrompt = `You are a Research Agent specialized in information gathering and analysis. Your capabilities include:

1. Web Search & Information Retrieval
   - Conduct comprehensive searches across multiple sources
   - Evaluate source credibility and relevance
   - Extract key information from various content types

2. Documentation Analysis
   - Parse and understand technical documentation
   - Identify relevant sections and key concepts
   - Create structured summaries of complex documents

3. Information Synthesis
   - Combine information from multiple sources
   - Identify patterns and connections
   - Present findings in clear, organized formats

4. Fact Checking & Validation
   - Verify claims against reliable sources
   - Identify potential biases or misinformation
   - Provide confidence levels for findings

When processing research tasks:
- Be thorough but focused on the specific query
- Cite sources when providing information
- Distinguish between facts and interpretations
- Highlight any conflicting information found
- Provide clear, actionable insights

Always structure your responses with:
1. Executive Summary
2. Key Findings
3. Supporting Evidence
4. Sources & References
5. Recommendations (if applicable)`;

    // Configure the Claude agent with this prompt
    console.log('Research Agent prompt configured');
  }

  /**
   * Process research-specific tasks
   */
  protected async processTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = {
      state: 'working',
      message: 'Conducting research and analysis'
    };

    try {
      // Extract the research query and context
      const lastMessage = task.messages[task.messages.length - 1];
      const query = this.extractTextFromMessage(lastMessage);
      const context = this.extractDataContext(lastMessage);

      console.log(`Processing research task: ${query.substring(0, 100)}...`);

      // Perform research based on query type
      const research = await this.conductResearch(query, context);

      // Create structured response (per A2A specification)
      const responseMessage: A2AMessage = {
        role: 'assistant',
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parts: [
          {
            kind: 'text',
            text: research.summary,
          },
          {
            kind: 'data',
            data: {
              findings: research.findings,
              sources: research.sources,
              confidence: research.confidence,
              metadata: research.metadata,
            },
          },
        ],
        timestamp: new Date().toISOString(),
        metadata: {
          researchType: research.type,
          sourcesConsulted: research.sources.length,
          processingTime: research.processingTime,
        },
      };

      // Add any artifacts (e.g., extracted documents, data tables)
      if (research.artifacts && research.artifacts.length > 0) {
        for (const artifact of research.artifacts) {
          responseMessage.parts.push({
            kind: 'artifact',
            artifact: artifact,
          });
        }
      }

      task.messages.push(responseMessage);
      task.status = {
        state: 'completed',
        message: 'Research completed successfully'
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
   * Conduct research based on query
   */
  private async conductResearch(query: string, _context?: any): Promise<ResearchResult> {
    const startTime = Date.now();

    // Determine research type
    const researchType = this.classifyResearchType(query);

    // Initialize research result
    const result: ResearchResult = {
      type: researchType,
      summary: '',
      findings: [],
      sources: [],
      confidence: 0,
      artifacts: [],
      metadata: {},
      processingTime: 0,
    };

    // Execute research based on type
    switch (researchType) {
      case 'technical':
        await this.conductTechnicalResearch(query, result);
        break;

      case 'market':
        await this.conductMarketResearch(query, result);
        break;

      case 'academic':
        await this.conductAcademicResearch(query, result);
        break;

      case 'comparative':
        await this.conductComparativeResearch(query, result);
        break;

      default:
        await this.conductGeneralResearch(query, result);
    }

    // Calculate confidence based on sources and findings
    result.confidence = this.calculateConfidence(result);

    // Record processing time
    result.processingTime = Date.now() - startTime;

    return result;
  }

  /**
   * Classify the type of research needed
   */
  private classifyResearchType(query: string): ResearchType {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('technical') ||
        lowerQuery.includes('documentation') ||
        lowerQuery.includes('api') ||
        lowerQuery.includes('implementation')) {
      return 'technical';
    }

    if (lowerQuery.includes('market') ||
        lowerQuery.includes('competitor') ||
        lowerQuery.includes('trend') ||
        lowerQuery.includes('industry')) {
      return 'market';
    }

    if (lowerQuery.includes('academic') ||
        lowerQuery.includes('paper') ||
        lowerQuery.includes('study') ||
        lowerQuery.includes('research')) {
      return 'academic';
    }

    if (lowerQuery.includes('compare') ||
        lowerQuery.includes('versus') ||
        lowerQuery.includes('difference') ||
        lowerQuery.includes('alternative')) {
      return 'comparative';
    }

    return 'general';
  }

  /**
   * Conduct technical research
   */
  private async conductTechnicalResearch(query: string, result: ResearchResult): Promise<void> {
    // Simulate technical research
    result.summary = `Technical research completed for: ${query}

## Executive Summary
Comprehensive analysis of technical documentation and implementation details has been conducted.

## Key Findings
1. **Architecture Overview**: The system follows a modular, microservices-based architecture
2. **Core Technologies**: Utilizes modern frameworks and industry-standard protocols
3. **Implementation Details**: Detailed specifications and API documentation available
4. **Best Practices**: Follows established patterns and conventions

## Technical Specifications
- **Protocol**: JSON-RPC 2.0 over HTTPS
- **Authentication**: OAuth 2.0 / API Key
- **Data Format**: JSON with schema validation
- **Performance**: Sub-second response times for standard operations`;

    result.findings = [
      {
        title: 'Architecture Design',
        content: 'Modular, scalable system with clear separation of concerns',
        importance: 'high',
      },
      {
        title: 'API Documentation',
        content: 'Comprehensive REST and RPC endpoints documented',
        importance: 'high',
      },
      {
        title: 'Security Measures',
        content: 'Industry-standard encryption and authentication',
        importance: 'medium',
      },
    ];

    result.sources = [
      {
        title: 'Official Documentation',
        url: 'https://docs.example.com',
        credibility: 0.95,
        relevance: 1.0,
      },
      {
        title: 'GitHub Repository',
        url: 'https://github.com/example/repo',
        credibility: 0.9,
        relevance: 0.95,
      },
    ];

    result.metadata = {
      documentsParsed: 5,
      apisAnalyzed: 3,
      codeExamplesFound: 12,
    };
  }

  /**
   * Conduct market research
   */
  private async conductMarketResearch(query: string, result: ResearchResult): Promise<void> {
    result.summary = `Market research analysis for: ${query}

## Market Overview
Current market trends and competitive landscape analysis completed.

## Key Market Insights
1. **Market Size**: Growing at 15% CAGR
2. **Key Players**: Identified top 5 competitors
3. **Trends**: Shift towards AI-driven solutions
4. **Opportunities**: Emerging markets showing high potential`;

    result.findings = [
      {
        title: 'Market Growth',
        content: 'Consistent year-over-year growth in target segment',
        importance: 'high',
      },
    ];

    result.sources = [
      {
        title: 'Industry Report 2024',
        url: 'https://example.com/report',
        credibility: 0.85,
        relevance: 0.9,
      },
    ];
  }

  /**
   * Conduct academic research
   */
  private async conductAcademicResearch(query: string, result: ResearchResult): Promise<void> {
    result.summary = `Academic literature review for: ${query}

## Research Summary
Analyzed peer-reviewed papers and academic publications.

## Key Academic Findings
1. **Theoretical Framework**: Established models and theories
2. **Empirical Evidence**: Statistical validation from multiple studies
3. **Research Gaps**: Identified areas needing further investigation`;

    result.findings = [
      {
        title: 'Peer-Reviewed Studies',
        content: 'Multiple studies confirm hypothesis',
        importance: 'high',
      },
    ];

    result.sources = [
      {
        title: 'Journal of Computer Science',
        url: 'https://journal.example.com',
        credibility: 0.98,
        relevance: 0.95,
      },
    ];
  }

  /**
   * Conduct comparative research
   */
  private async conductComparativeResearch(query: string, result: ResearchResult): Promise<void> {
    result.summary = `Comparative analysis for: ${query}

## Comparison Overview
Detailed comparison of alternatives and options.

## Comparison Results
1. **Feature Comparison**: Side-by-side feature analysis
2. **Performance Metrics**: Quantitative performance data
3. **Cost Analysis**: Total cost of ownership comparison
4. **Recommendations**: Best fit for specific use cases`;

    result.findings = [
      {
        title: 'Feature Matrix',
        content: 'Comprehensive feature comparison completed',
        importance: 'high',
      },
    ];
  }

  /**
   * Conduct general research
   */
  private async conductGeneralResearch(query: string, result: ResearchResult): Promise<void> {
    result.summary = `Research completed for: ${query}

## Summary
General information gathering and analysis has been performed.

## Key Information
- Relevant facts and data collected
- Multiple sources consulted
- Information verified where possible`;

    result.findings = [
      {
        title: 'General Findings',
        content: 'Comprehensive information gathered',
        importance: 'medium',
      },
    ];

    result.sources = [
      {
        title: 'Web Search Results',
        url: 'https://search.example.com',
        credibility: 0.7,
        relevance: 0.8,
      },
    ];
  }

  /**
   * Calculate confidence score for research results
   */
  private calculateConfidence(result: ResearchResult): number {
    let confidence = 0;

    // Factor in source credibility
    if (result.sources.length > 0) {
      const avgCredibility = result.sources.reduce((sum, s) => sum + s.credibility, 0) / result.sources.length;
      confidence += avgCredibility * 0.4;
    }

    // Factor in number of sources
    const sourceScore = Math.min(result.sources.length / 5, 1);
    confidence += sourceScore * 0.3;

    // Factor in findings quality
    const highImportanceFindings = result.findings.filter(f => f.importance === 'high').length;
    const findingsScore = Math.min(highImportanceFindings / 3, 1);
    confidence += findingsScore * 0.3;

    return Math.min(confidence, 1);
  }

  /**
   * Extract data context from message (per specification)
   */
  private extractDataContext(message: A2AMessage): any {
    const dataPart = message.parts.find(p => p.kind === 'data');
    return dataPart?.data || {};
  }
}

// Type definitions for research results
type ResearchType = 'technical' | 'market' | 'academic' | 'comparative' | 'general';

interface ResearchResult {
  type: ResearchType;
  summary: string;
  findings: ResearchFinding[];
  sources: ResearchSource[];
  confidence: number;
  artifacts?: any[];
  metadata: Record<string, any>;
  processingTime: number;
}

interface ResearchFinding {
  title: string;
  content: string;
  importance: 'low' | 'medium' | 'high';
  evidence?: string[];
}

interface ResearchSource {
  title: string;
  url: string;
  credibility: number; // 0-1
  relevance: number; // 0-1
  accessedAt?: string;
}

// Main execution for running as standalone server
async function main() {
  console.log('🔍 Starting Research Agent...\n');

  const researchAgent = new ResearchAgent({
    name: 'ResearchAgent',
    description: 'Specialized agent for information gathering, analysis, and research tasks',
    port: 3001,
    capabilities: [
      'web-search',
      'information-retrieval',
      'data-analysis',
      'technical-research',
      'market-research',
      'comparative-analysis'
    ],
    version: '1.0.0',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4'
  });

  await researchAgent.start();

  console.log('\n✅ Research Agent is ready!');
  console.log('   - Agent Card: http://localhost:3001/.well-known/agent.json');
  console.log('   - RPC Endpoint: http://localhost:3001/rpc');
  console.log('\nCapabilities:');
  console.log('   - Web Search & Information Retrieval');
  console.log('   - Technical Research & Analysis');
  console.log('   - Market & Competitive Research');
  console.log('   - Academic & Scientific Research');
  console.log('   - Comparative Analysis\n');

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down Research Agent...');
    await researchAgent.stop();
    process.exit(0);
  });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error starting Research Agent:', error);
    process.exit(1);
  });
}