# Claude Code Built-in Tools Reference

A comprehensive guide to all built-in tools available in Claude Code.

---

## 📁 File Operations

### Read
Reads files from the local filesystem.

**Parameters:**
- `file_path` (required) - Absolute path to the file
- `offset` (optional) - Line number to start reading from
- `limit` (optional) - Number of lines to read

**Features:**
- Reads text files, images (PNG, JPG), PDFs, and Jupyter notebooks
- Returns content with line numbers (cat -n format)
- Handles files up to 2000 lines by default
- Truncates lines longer than 2000 characters

**Example:**
```typescript
Read({ file_path: "/path/to/file.ts" })
Read({ file_path: "/path/to/large-file.ts", offset: 100, limit: 50 })
```

---

### Write
Creates new files or overwrites existing files.

**Parameters:**
- `file_path` (required) - Absolute path where file will be created
- `content` (required) - Content to write to the file

**Important:**
- Must use Read tool first if overwriting an existing file
- Prefer Edit tool for modifying existing files
- Don't create documentation files unless explicitly requested

**Example:**
```typescript
Write({
  file_path: "/path/to/new-file.ts",
  content: "console.log('Hello, world!');"
})
```

---

### Edit
Performs exact string replacements in existing files.

**Parameters:**
- `file_path` (required) - Absolute path to the file
- `old_string` (required) - Exact text to replace
- `new_string` (required) - Replacement text
- `replace_all` (optional) - Replace all occurrences (default: false)

**Important:**
- Must use Read tool before editing
- Preserve exact indentation from file (ignore line number prefixes)
- `old_string` must be unique unless using `replace_all`
- Edit fails if `old_string` not found or not unique

**Example:**
```typescript
Edit({
  file_path: "/path/to/file.ts",
  old_string: "function oldName() {",
  new_string: "function newName() {"
})

// Rename variable throughout file
Edit({
  file_path: "/path/to/file.ts",
  old_string: "oldVarName",
  new_string: "newVarName",
  replace_all: true
})
```

---

### NotebookEdit
Edits cells in Jupyter notebooks (.ipynb files).

**Parameters:**
- `notebook_path` (required) - Absolute path to notebook
- `new_source` (required) - New cell content
- `cell_id` (optional) - ID of cell to edit
- `cell_type` (optional) - "code" or "markdown"
- `edit_mode` (optional) - "replace", "insert", or "delete"

**Example:**
```typescript
NotebookEdit({
  notebook_path: "/path/to/notebook.ipynb",
  cell_id: "abc123",
  new_source: "print('Updated code')",
  cell_type: "code"
})
```

---

## 🔍 Search & Discovery

### Glob
Fast file pattern matching using glob patterns.

**Parameters:**
- `pattern` (required) - Glob pattern (e.g., "**/*.js", "src/**/*.ts")
- `path` (optional) - Directory to search in (defaults to current directory)

**Features:**
- Works with any codebase size
- Returns files sorted by modification time
- Supports standard glob syntax

**Example:**
```typescript
Glob({ pattern: "**/*.ts" })
Glob({ pattern: "src/**/*.test.js" })
Glob({ pattern: "*.{ts,tsx}", path: "/path/to/dir" })
```

---

### Grep
Powerful content search using ripgrep.

**Parameters:**
- `pattern` (required) - Regular expression pattern
- `path` (optional) - File or directory to search
- `output_mode` (optional) - "content", "files_with_matches", "count"
- `glob` (optional) - Filter by file pattern (e.g., "*.js")
- `type` (optional) - File type filter (e.g., "js", "py", "rust")
- `-i` (optional) - Case insensitive search
- `-n` (optional) - Show line numbers (requires output_mode: "content")
- `-A`, `-B`, `-C` (optional) - Context lines after/before/both
- `multiline` (optional) - Enable multiline matching
- `head_limit` (optional) - Limit output to first N results

**Features:**
- Full regex support
- Fast searching across large codebases
- Multiple output formats
- Context line support

**Example:**
```typescript
// Find files containing pattern
Grep({ pattern: "function.*export", output_mode: "files_with_matches" })

// Show matching lines with context
Grep({
  pattern: "TODO",
  output_mode: "content",
  "-n": true,
  "-C": 2,
  glob: "*.ts"
})

// Case insensitive search
Grep({ pattern: "error", "-i": true, type: "js" })

// Multiline search
Grep({
  pattern: "interface.*\\{[\\s\\S]*?\\}",
  multiline: true,
  output_mode: "content"
})
```

---

## 💻 System & Terminal

### Bash
Executes shell commands in a persistent session.

**Parameters:**
- `command` (required) - Shell command to execute
- `description` (optional) - Brief description of what command does
- `timeout` (optional) - Timeout in milliseconds (max 600000, default 120000)
- `run_in_background` (optional) - Run command in background

**Features:**
- Persistent shell session maintains working directory
- Supports command chaining with `&&`, `;`
- Can run background processes
- Handles quoted paths with spaces

**Important:**
- Use specialized tools (Read/Write/Edit/Glob/Grep) instead of cat/grep/find/sed/awk
- Quote paths with spaces: `cd "path with spaces"`
- Chain dependent commands with `&&`
- Run independent commands in parallel via multiple tool calls

**Example:**
```typescript
Bash({ command: "npm install", description: "Install dependencies" })
Bash({ command: "git status && git diff", description: "Show git status and changes" })
Bash({ command: "npm run dev", run_in_background: true })
```

**Git commit example:**
```bash
git commit -m "$(cat <<'EOF'
Add new feature

This commit implements the feature requested by user.
EOF
)"
```

---

### BashOutput
Retrieves output from background bash processes.

**Parameters:**
- `bash_id` (required) - ID of background shell
- `filter` (optional) - Regex to filter output lines

**Example:**
```typescript
BashOutput({ bash_id: "shell_123" })
BashOutput({ bash_id: "shell_123", filter: "ERROR|WARN" })
```

---

### KillShell
Terminates a running background shell.

**Parameters:**
- `shell_id` (required) - ID of shell to terminate

**Example:**
```typescript
KillShell({ shell_id: "shell_123" })
```

---

## 🌐 Web Access

### WebSearch
Searches the web for current information.

**Parameters:**
- `query` (required) - Search query
- `allowed_domains` (optional) - Only include results from these domains
- `blocked_domains` (optional) - Exclude results from these domains

**Features:**
- Provides up-to-date information beyond knowledge cutoff
- Domain filtering support
- Only available in US

**Example:**
```typescript
WebSearch({ query: "TypeScript 5.3 release notes 2024" })
WebSearch({
  query: "React hooks documentation",
  allowed_domains: ["react.dev", "reactjs.org"]
})
```

---

### WebFetch
Fetches and analyzes content from URLs.

**Parameters:**
- `url` (required) - URL to fetch
- `prompt` (required) - What information to extract

**Features:**
- Converts HTML to markdown
- Processes content with AI model
- 15-minute cache for repeated access
- Auto-upgrades HTTP to HTTPS
- Read-only operation

**Important:**
- Prefer MCP web fetch tools (mcp__*) if available
- Handle redirects by making new request with redirect URL

**Example:**
```typescript
WebFetch({
  url: "https://docs.example.com/api",
  prompt: "Extract all API endpoints and their parameters"
})
```

---

## 📋 Task Management

### TodoWrite
Creates and manages structured task lists.

**Parameters:**
- `todos` (required) - Array of todo items with:
  - `content` - Imperative form (e.g., "Run tests")
  - `activeForm` - Present continuous form (e.g., "Running tests")
  - `status` - "pending", "in_progress", or "completed"

**When to use:**
- Complex tasks with 3+ steps
- Non-trivial tasks requiring planning
- User provides multiple tasks
- Tracking progress on long-running work

**When NOT to use:**
- Single straightforward task
- Trivial tasks
- Purely conversational requests

**Best practices:**
- Only ONE task should be "in_progress" at a time
- Mark tasks completed immediately after finishing
- Update status in real-time
- Don't mark completed if errors/blockers exist

**Example:**
```typescript
TodoWrite({
  todos: [
    {
      content: "Install dependencies",
      activeForm: "Installing dependencies",
      status: "completed"
    },
    {
      content: "Run build process",
      activeForm: "Running build process",
      status: "in_progress"
    },
    {
      content: "Fix type errors",
      activeForm: "Fixing type errors",
      status: "pending"
    }
  ]
})
```

---

### Task
Launches specialized sub-agents for complex tasks.

**Parameters:**
- `subagent_type` (required) - Type of agent to launch
- `prompt` (required) - Detailed task description
- `description` (required) - Short 3-5 word description

**Available agents:**
- `general-purpose` - Complex research, code search, multi-step tasks
- `statusline-setup` - Configure Claude Code status line
- `output-style-setup` - Create Claude Code output styles

**When to use:**
- Open-ended searches requiring multiple rounds
- Complex multi-step research
- Tasks matching agent specialization

**When NOT to use:**
- Reading specific known file paths (use Read)
- Searching for specific class (use Glob)
- Searching within 2-3 known files (use Read)

**Important:**
- Each agent invocation is stateless
- Provide highly detailed task description
- Specify exactly what information to return
- Can run multiple agents in parallel
- Tell agent whether to write code or just research

**Example:**
```typescript
Task({
  subagent_type: "general-purpose",
  description: "Search authentication implementation",
  prompt: `Search the codebase for authentication implementation.
  Find all files related to user authentication, session management,
  and token validation. Return a summary of the architecture and
  list of key files with their purposes.`
})

// Run multiple agents in parallel
Task({ subagent_type: "general-purpose", ... })
Task({ subagent_type: "general-purpose", ... })
```

---

### ExitPlanMode
Exits planning mode after presenting a plan.

**Parameters:**
- `plan` (required) - Concise markdown plan to present

**When to use:**
- In plan mode after finishing research
- Planning implementation steps for coding tasks

**When NOT to use:**
- Research tasks (gathering info, understanding codebase)
- Reading/searching files without implementation

**Example:**
```typescript
ExitPlanMode({
  plan: `1. Update authentication module to use JWT
2. Add token validation middleware
3. Update tests
4. Run test suite`
})
```

---

### SlashCommand
Executes custom user-defined slash commands.

**Parameters:**
- `command` (required) - Slash command with arguments (e.g., "/review-pr 123")

**Available commands in this project:**
- `/drizzle:add-with-neon` - Adds Drizzle/Neon
- `/neon:cli` - Use the neon CLI
- `/cf:scaffold-worker` - Scaffold Cloudflare worker

**Important:**
- Only use for custom commands listed above
- Don't use for built-in CLI commands
- Don't invoke if command is already running
- Execute multiple commands sequentially

**Example:**
```typescript
SlashCommand({ command: "/neon:cli --help" })
```

---

## 📊 Tool Usage Best Practices

### Parallel vs Sequential Execution
```typescript
// ✅ GOOD: Run independent reads in parallel
Read({ file_path: "/path/to/file1.ts" })
Read({ file_path: "/path/to/file2.ts" })
Bash({ command: "git status" })

// ✅ GOOD: Chain dependent commands
Bash({ command: "mkdir foo && cp file.txt foo/" })

// ❌ BAD: Don't use placeholders
// Wait for results before calling dependent tools
```

### Prefer Specialized Tools
```typescript
// ✅ GOOD
Read({ file_path: "/path/to/file.ts" })
Grep({ pattern: "function", glob: "*.ts" })
Edit({ file_path: "/path/to/file.ts", old_string: "...", new_string: "..." })

// ❌ BAD
Bash({ command: "cat /path/to/file.ts" })
Bash({ command: "grep 'function' *.ts" })
Bash({ command: "sed -i 's/old/new/' file.ts" })
```

### File Operations Workflow
```typescript
// 1. Read file first
Read({ file_path: "/path/to/file.ts" })

// 2. Then edit or overwrite
Edit({
  file_path: "/path/to/file.ts",
  old_string: "old code",
  new_string: "new code"
})
```

---

## 🔑 Key Principles

1. **Use specialized tools** over bash commands for file operations
2. **Run independent operations in parallel** via multiple tool calls
3. **Read files before editing** them
4. **Provide context** with description parameters
5. **Track complex tasks** with TodoWrite
6. **Delegate complex research** to Task agents
7. **Prefer exact matching** (Edit) over regex (Grep) for replacements
8. **Use Glob for file discovery**, Grep for content search

---

## 📚 Additional Resources

- Claude Code Documentation: https://docs.claude.com/en/docs/claude-code
- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Use `/help` command for CLI help
