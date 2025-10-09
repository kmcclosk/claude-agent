#!/usr/bin/env node

// Example: Claude Agent SDK - Practical Implementation
// This demonstrates real-world usage patterns of the Claude Agent SDK

import {
    query,
    createSdkMcpServer,
    tool,
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
                .filter((c: any) => c.type === 'text')
                .map((c: any) => 'text' in c ? c.text : '')
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
        prompt: "You are a development assistant. Help with testing, linting, building, and fixing code issues. Start by linting.",
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
                    hooks: [async (input: HookInput, _toolUseId: string | undefined, { signal: _signal }): Promise<HookJSONOutput> => {
                        if (input.hook_event_name === 'PreToolUse') {
                            console.log(`  ⚙️  ${input.tool_name}: ${JSON.stringify(input.tool_input).slice(0, 50)}...`);
                        }
                        return { continue: true };
                    }]
                }],
                PostToolUse: [{
                    hooks: [async (input: HookInput, _toolUseId: string | undefined, { signal: _signal }): Promise<HookJSONOutput> => {
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
                (c: any): c is ToolUse => c.type === 'tool_use' && 'name' in c && c.name === 'Edit'
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
                (c: any): c is ToolUse =>
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

        console.log('canUseTool', { toolName, input, signal, suggestions });

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
        prompt: "Review the .env and README.md files in the projec only",
        options: {
            canUseTool
        }
    });

    for await (const message of secureAgent) {
        console.log(JSON.stringify(message, null, 2));
        if (message.type === 'result') {
            console.log('\nOperation complete with security checks enforced');
        }
    }
}

// Example 5: Prompts
async function prompts(): Promise<void> {

    const stream = query({
        prompt: (async function* () {
            yield {
                type: 'user' as const,
                parent_tool_use_id: null,
                message: {
                    role: 'user' as const,
                    content: 'during the years Texas was independent - what form of government?',
                },
                session_id: '',
            };
            yield {
                type: 'user' as const,
                parent_tool_use_id: null,
                message: {
                    role: 'user' as const,
                    content: 'Who were the leaders?'
                },
                session_id: '',
            };
        })(),
        options: {
            systemPrompt: 'You are a general helpful assistant who always answers the user with a humorous joke.',
            canUseTool: async (toolName, toolInput) => {
                console.log('canUseTool', { toolName, toolInput });
                return { behavior: "allow", updatedInput: toolInput };
            }
        }
    });

    for await (const message of stream) {
        console.log(JSON.stringify(message, null, 2));
        if (message.type === 'result') {
            // break;
        }
    }
}

// Example 6: Inline MCP Server with Current Time
async function mcpServerExample(): Promise<void> {
    console.log('⏰ MCP Server Example - Current Time\n');

    // Create an inline MCP server with a getCurrentTime tool
    const timeServer = createSdkMcpServer({
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

    // Query the agent to use the MCP server
    const timeAgent = query({
        prompt: 'What is the current time? Please use the getCurrentTime tool to get the current time in ISO format, and then tell me what time it is in a friendly way.',
        options: {
            mcpServers: { 'time-server': timeServer },
            maxTurns: 5,
            permissionMode: 'bypassPermissions'  // Automatically allow tool use
        }
    });

    console.log('🤖 Agent is querying the time server...\n');

    for await (const message of timeAgent) {
        if (message.type === 'assistant') {
            const assistantMsg = message as SDKAssistantMessage;

            // Show tool uses
            const toolUses = assistantMsg.message.content.filter((c: any) => c.type === 'tool_use');
            for (const toolUse of toolUses) {
                if ('name' in toolUse && toolUse.name === 'getCurrentTime') {
                    console.log('  🔧 Tool called: getCurrentTime');
                    console.log('  📥 Input:', JSON.stringify(toolUse.input, null, 2));
                }
            }

            // Show text responses
            const textContent = assistantMsg.message.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => 'text' in c ? c.text : '')
                .join('\n');

            if (textContent) {
                console.log('\n💬 Assistant:', textContent);
            }
        }

        if (message.type === 'result') {
            const resultMsg = message as SDKResultMessage;
            console.log('\n✅ Query complete!');
            console.log(`   Duration: ${resultMsg.duration_ms}ms`);
            console.log(`   Turns: ${resultMsg.num_turns}`);
            console.log(`   Cost: $${resultMsg.total_cost_usd}`);
        }
    }
}

// Helper function to handle agent messages
function handleAgentMessage(message: SDKMessage): void {
    console.log(JSON.stringify(message, null, 2));
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
                .filter((c: any) => c.type === 'text')
                .map((c: any) => 'text' in c ? c.text : '')
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

            case 'prompts':
                await prompts();
                break;

            case 'mcp':
                await mcpServerExample();
                break;

            default:
                console.log('Claude Agent SDK Examples\n');
                console.log('Usage: node example-agent.ts <command> [options]\n');
                console.log('Commands:');
                console.log('  analyze [dir]   - Analyze a codebase');
                console.log('  dev             - Start development assistant');
                console.log('  refactor <file> - Refactor a file with hooks');
                console.log('  background      - Run background tasks');
                console.log('  secure          - Demo secure file operations');
                console.log('  prompts         - Multiple prompts');
                console.log('  mcp             - Inline MCP server with current time');
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
    secureFileOperations,
    mcpServerExample
};
