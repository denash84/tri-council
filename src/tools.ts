import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  isCliAvailable,
  spawnAgentWithRetries,
  buildPrompt,
  type FileContext,
} from "./agents.js";
import type { AgentConfig, Config } from "./config.js";

interface SummonInput {
  agent: string;
  prompt: string;
  files?: string[];
  cwd?: string;
}

interface ToolResult {
  text: string;
  isError?: boolean;
}

function isValidAgentConfig(agent: unknown): agent is AgentConfig {
  if (typeof agent !== "object" || agent === null) {
    return false;
  }

  const candidate = agent as Record<string, unknown>;
  return (
    typeof candidate.command === "string" &&
    Array.isArray(candidate.args) &&
    candidate.args.every((arg) => typeof arg === "string") &&
    typeof candidate.role === "string"
  );
}

export async function handleListAgents(config: Config): Promise<string> {
  const entries = Object.entries(config.agents);
  const lines = await Promise.all(
    entries.map(async ([name, agent]) => {
      if (!isValidAgentConfig(agent)) {
        return `- **${name}**: invalid config`;
      }

      const available = await isCliAvailable(agent.command);
      const status = available ? "available" : `not found (${agent.command})`;
      return `- **${name}** (${agent.role}): \`${agent.command}\` — ${status}`;
    }),
  );
  return lines.join("\n");
}

export async function handleSummon(
  input: SummonInput,
  config: Config,
): Promise<ToolResult> {
  const { agent: agentName, prompt, files = [], cwd } = input;

  // Validate agent exists
  const agentConfig = config.agents[agentName];
  if (!agentConfig) {
    const available = Object.keys(config.agents).join(", ");
    return {
      text: `Agent '${agentName}' not found. Available agents: ${available}`,
      isError: true,
    };
  }

  if (!isValidAgentConfig(agentConfig)) {
    return {
      text: `Agent '${agentName}' has invalid configuration`,
      isError: true,
    };
  }

  // Check CLI binary
  const available = await isCliAvailable(agentConfig.command);
  if (!available) {
    return {
      text: `Agent '${agentName}' is not available — CLI '${agentConfig.command}' not found on PATH`,
      isError: true,
    };
  }

  // Read file context
  let fileContexts: FileContext[] = [];
  if (files.length > 0) {
    const missing: string[] = [];
    const loaded: FileContext[] = [];

    const baseDir = cwd ?? process.cwd();
    for (const filePath of files) {
      try {
        const resolvedPath = resolve(baseDir, filePath);
        const content = await readFile(resolvedPath, "utf-8");
        loaded.push({ path: filePath, content });
      } catch {
        missing.push(filePath);
      }
    }

    if (missing.length > 0) {
      return {
        text: `Files not found: ${missing.join(", ")}`,
        isError: true,
      };
    }

    fileContexts = loaded;
  }

  // Build prompt with file context
  const fullPrompt = buildPrompt(prompt, fileContexts);

  // Expand args template
  const expandedArgs = agentConfig.args.map((arg) =>
    arg.replaceAll("{prompt}", fullPrompt),
  );

  // Spawn agent with retries
  const result = await spawnAgentWithRetries({
    command: agentConfig.command,
    args: expandedArgs,
    cwd: cwd ?? process.cwd(),
    timeout: config.timeout,
    maxRetries: config.maxRetries,
  });

  // Handle timeout
  if (result.timedOut) {
    const partial = result.stdout || "(no output captured)";
    const attemptNote =
      result.attempts > 1 ? ` (${result.attempts} attempts)` : "";
    return {
      text: `[${agentName} timed out after ${config.timeout / 1000}s${attemptNote}]\n\n${partial}`,
      isError: true,
    };
  }

  // Handle non-zero exit
  if (result.exitCode !== 0) {
    const attemptNote =
      result.attempts > 1 ? ` after ${result.attempts} attempts` : "";
    return {
      text: `${agentName} exited with code ${result.exitCode}${attemptNote}:\n${result.stderr || result.stdout}`,
      isError: true,
    };
  }

  // Success
  return {
    text: result.stdout,
  };
}
