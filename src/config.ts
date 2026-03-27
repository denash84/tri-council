import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface AgentConfig {
  command: string;
  args: string[];
  role: string;
}

export interface Config {
  agents: Record<string, AgentConfig>;
  timeout: number;
  maxRetries: number;
}

export const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  Claude: {
    command: "claude",
    args: ["-p", "{prompt}", "--output-format", "text"],
    role: "architect",
  },
  Codex: {
    command: "codex",
    args: ["exec", "{prompt}"],
    role: "implementer",
  },
  Gemini: {
    command: "gemini",
    args: ["-p", "{prompt}", "-o", "text"],
    role: "skeptic",
  },
};

const DEFAULT_TIMEOUT = 300_000;
const DEFAULT_MAX_RETRIES = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function cloneAgentConfig(agent: AgentConfig): AgentConfig {
  return {
    command: agent.command,
    args: [...agent.args],
    role: agent.role,
  };
}

function mergeAgentConfig(
  baseAgent: AgentConfig | undefined,
  override: unknown,
): AgentConfig | null {
  if (!isRecord(override)) {
    return baseAgent ? cloneAgentConfig(baseAgent) : null;
  }

  const command =
    typeof override.command === "string" ? override.command : baseAgent?.command;
  const args = isStringArray(override.args) ? override.args : baseAgent?.args;
  const role =
    typeof override.role === "string" ? override.role : baseAgent?.role;

  if (
    typeof command !== "string" ||
    !Array.isArray(args) ||
    typeof role !== "string"
  ) {
    return null;
  }

  return {
    command,
    args: [...args],
    role,
  };
}

function mergeAgents(userAgents: unknown): Record<string, AgentConfig> {
  const merged = Object.fromEntries(
    Object.entries(DEFAULT_AGENTS).map(([name, agent]) => [
      name,
      cloneAgentConfig(agent),
    ]),
  ) as Record<string, AgentConfig>;

  if (!isRecord(userAgents)) {
    return merged;
  }

  for (const [name, override] of Object.entries(userAgents)) {
    const mergedAgent = mergeAgentConfig(DEFAULT_AGENTS[name], override);
    if (mergedAgent) {
      merged[name] = mergedAgent;
    }
  }

  return merged;
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export async function loadConfig(): Promise<Config> {
  const defaults: Config = {
    agents: mergeAgents(undefined),
    timeout: DEFAULT_TIMEOUT,
    maxRetries: DEFAULT_MAX_RETRIES,
  };

  const configPath = join(homedir(), ".tri-council", "config.json");

  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      agents: mergeAgents(parsed.agents),
      timeout: normalizePositiveInt(parsed.timeout, defaults.timeout),
      maxRetries: normalizePositiveInt(parsed.maxRetries, defaults.maxRetries),
    };
  } catch {
    return defaults;
  }
}
