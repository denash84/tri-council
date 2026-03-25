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
  Grok: {
    command: "grok",
    args: ["-p", "{prompt}"],
    role: "challenger",
  },
};

const DEFAULT_TIMEOUT = 300_000;
const DEFAULT_MAX_RETRIES = 3;

export async function loadConfig(): Promise<Config> {
  const defaults: Config = {
    agents: { ...DEFAULT_AGENTS },
    timeout: DEFAULT_TIMEOUT,
    maxRetries: DEFAULT_MAX_RETRIES,
  };

  const configPath = join(homedir(), ".tri-council", "config.json");

  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      agents: {
        ...defaults.agents,
        ...(parsed.agents ?? {}),
      },
      timeout:
        typeof parsed.timeout === "number" ? parsed.timeout : defaults.timeout,
      maxRetries:
        typeof parsed.maxRetries === "number"
          ? parsed.maxRetries
          : defaults.maxRetries,
    };
  } catch {
    return defaults;
  }
}
