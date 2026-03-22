import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildPrompt,
  isCliAvailable,
  spawnAgent,
  spawnAgentWithRetries,
} from "./agents.js";

describe("buildPrompt", () => {
  it("returns prompt as-is when no files provided", () => {
    const result = buildPrompt("What is this code?", []);
    expect(result).toBe("What is this code?");
  });

  it("prepends file contents as fenced code blocks", () => {
    const files = [{ path: "src/foo.ts", content: "export const x = 1;" }];
    const result = buildPrompt("Review this", files);
    expect(result).toContain("```src/foo.ts");
    expect(result).toContain("export const x = 1;");
    expect(result).toContain("```");
    expect(result).toContain("Review this");
  });

  it("prepends multiple files", () => {
    const files = [
      { path: "a.ts", content: "const a = 1;" },
      { path: "b.ts", content: "const b = 2;" },
    ];
    const result = buildPrompt("Check these", files);
    expect(result).toContain("```a.ts");
    expect(result).toContain("```b.ts");
    expect(result).toContain("Check these");
  });
});

describe("isCliAvailable", () => {
  it("returns true for a command that exists (node)", async () => {
    const result = await isCliAvailable("node");
    expect(result).toBe(true);
  });

  it("returns false for a command that does not exist", async () => {
    const result = await isCliAvailable("nonexistent-binary-xyz-123");
    expect(result).toBe(false);
  });
});

describe("spawnAgent", () => {
  it("spawns echo and captures output", async () => {
    const result = await spawnAgent({
      command: "echo",
      args: ["hello world"],
      cwd: process.cwd(),
      timeout: 5000,
    });
    expect(result.stdout.trim()).toBe("hello world");
    expect(result.exitCode).toBe(0);
  });

  it("returns stderr on failing command", async () => {
    const result = await spawnAgent({
      command: "node",
      args: ["-e", "process.stderr.write('err'); process.exit(1)"],
      cwd: process.cwd(),
      timeout: 5000,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("err");
  });

  it("kills process on timeout and returns partial output", async () => {
    const result = await spawnAgent({
      command: "node",
      args: [
        "-e",
        "console.log('start'); setTimeout(() => console.log('end'), 10000)",
      ],
      cwd: process.cwd(),
      timeout: 500,
    });
    expect(result.timedOut).toBe(true);
    expect(result.stdout).toContain("start");
  });
});

describe("spawnAgentWithRetries", () => {
  const baseOptions = {
    command: "echo",
    args: ["hi"],
    cwd: process.cwd(),
    timeout: 5000,
    maxRetries: 3,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns on first success without retrying", async () => {
    const mock = vi.fn().mockResolvedValueOnce({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });

    const result = await spawnAgentWithRetries(baseOptions, mock);

    expect(result.stdout).toBe("ok");
    expect(result.attempts).toBe(1);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retries on timeout then succeeds", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: "partial",
        stderr: "",
        exitCode: null,
        timedOut: true,
      })
      .mockResolvedValueOnce({
        stdout: "success",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });

    const promise = spawnAgentWithRetries(baseOptions, mock);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.stdout).toBe("success");
    expect(result.attempts).toBe(2);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("retries on non-zero exit then succeeds", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "error",
        exitCode: 1,
        timedOut: false,
      })
      .mockResolvedValueOnce({
        stdout: "recovered",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });

    const promise = spawnAgentWithRetries(baseOptions, mock);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.stdout).toBe("recovered");
    expect(result.attempts).toBe(2);
  });

  it("does not retry on spawn error (binary not found)", async () => {
    const mock = vi.fn().mockResolvedValueOnce({
      stdout: "",
      stderr: "spawn ENOENT",
      exitCode: null,
      timedOut: false,
    });

    const result = await spawnAgentWithRetries(baseOptions, mock);

    expect(result.exitCode).toBeNull();
    expect(result.timedOut).toBe(false);
    expect(result.attempts).toBe(1);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("returns last result when all retries exhausted", async () => {
    const mock = vi.fn().mockResolvedValue({
      stdout: "partial",
      stderr: "",
      exitCode: null,
      timedOut: true,
    });

    const promise = spawnAgentWithRetries(
      { ...baseOptions, maxRetries: 2 },
      mock,
    );
    await vi.advanceTimersByTimeAsync(4000);
    const result = await promise;

    expect(result.timedOut).toBe(true);
    expect(result.attempts).toBe(2);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
