import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface FileContext {
  path: string;
  content: string;
}

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd: string;
  timeout: number;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export function buildPrompt(prompt: string, files: FileContext[]): string {
  if (files.length === 0) return prompt;

  const fileBlocks = files
    .map((f) => `\`\`\`${f.path}\n${f.content}\n\`\`\``)
    .join("\n\n");

  return `${fileBlocks}\n\n${prompt}`;
}

export async function isCliAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

export async function spawnAgentWithRetries(
  options: SpawnOptions & { maxRetries: number },
  _spawnAgent: (opts: SpawnOptions) => Promise<SpawnResult> = spawnAgent,
): Promise<SpawnResult & { attempts: number }> {
  const { maxRetries, ...spawnOptions } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await _spawnAgent(spawnOptions);

    // Don't retry spawn errors (binary not found, etc.)
    if (result.exitCode === null && !result.timedOut) {
      return { ...result, attempts: attempt };
    }

    // Success — no retry needed
    if (result.exitCode === 0 && !result.timedOut) {
      return { ...result, attempts: attempt };
    }

    // Last attempt — return whatever we got
    if (attempt === maxRetries) {
      return { ...result, attempts: attempt };
    }

    // Otherwise: timed out or non-zero exit — wait then retry
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Unexpected end of retry loop");
}

export async function spawnAgent(options: SpawnOptions): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const { command, args, cwd, timeout } = options;
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 2000);
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, timedOut });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, exitCode: null, timedOut: false });
    });
  });
}
