# tri-council

MCP server that summons Claude, Codex, Gemini, and Grok CLIs from any MCP client.

## Install

No installation needed — use `npx`:

```bash
# Add to Claude Code
claude mcp add tri-council -- npx tri-council mcp

# Add to Gemini CLI
gemini mcp add tri-council -- npx tri-council mcp

# Add to Codex
codex mcp add tri-council -- npx tri-council mcp
```

## Tools

### `summon`

Spawn an agent CLI with a prompt and optional file context.

| Parameter | Type     | Required | Description                              |
| --------- | -------- | -------- | ---------------------------------------- |
| `agent`   | string   | yes      | Agent name (Claude, Codex, Gemini, Grok) |
| `prompt`  | string   | yes      | The question or task                     |
| `files`   | string[] | no       | File paths to include as context         |
| `cwd`     | string   | no       | Working directory for the agent          |

### `list_agents`

List configured agents and whether their CLI is installed.

## Config

Optional override at `~/.tri-council/config.json`:

```json
{
  "agents": {
    "Claude": {
      "command": "claude",
      "args": ["-p", "{prompt}", "--output-format", "text"],
      "role": "architect"
    },
    "Codex": {
      "command": "codex",
      "args": ["exec", "{prompt}"],
      "role": "implementer"
    },
    "Gemini": {
      "command": "gemini",
      "args": ["-p", "{prompt}", "-o", "text"],
      "role": "skeptic"
    },
    "Grok": {
      "command": "grok",
      "args": ["-p", "{prompt}"],
      "role": "challenger"
    }
  },
  "timeout": 120000
}
```

Add any CLI agent by adding an entry. The `{prompt}` placeholder is replaced with the assembled prompt (including file context).

## License

MIT
