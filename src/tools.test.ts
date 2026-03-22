import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSummon, handleListAgents } from "./tools.js";
import * as agents from "./agents.js";
import { DEFAULT_AGENTS, type Config } from "./config.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("file content here"),
}));

const testConfig: Config = {
  agents: DEFAULT_AGENTS,
  timeout: 5000,
  maxRetries: 3,
};

describe("handleListAgents", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns all agents with availability status", async () => {
    vi.spyOn(agents, "isCliAvailable").mockResolvedValue(true);
    const result = await handleListAgents(testConfig);
    expect(result).toContain("Claude");
    expect(result).toContain("available");
  });

  it("marks unavailable agents", async () => {
    vi.spyOn(agents, "isCliAvailable").mockImplementation(async (cmd) => {
      return cmd !== "grok";
    });
    const result = await handleListAgents(testConfig);
    expect(result).toContain("Grok");
    expect(result).toContain("not found");
  });
});

describe("handleSummon", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error for unknown agent", async () => {
    const result = await handleSummon(
      { agent: "Unknown", prompt: "hi" },
      testConfig,
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Unknown");
  });

  it("returns error when CLI not found", async () => {
    vi.spyOn(agents, "isCliAvailable").mockResolvedValue(false);
    const result = await handleSummon(
      { agent: "Grok", prompt: "hi" },
      testConfig,
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("not found on PATH");
  });

  it("spawns agent and returns stdout on success", async () => {
    vi.spyOn(agents, "isCliAvailable").mockResolvedValue(true);
    vi.spyOn(agents, "spawnAgentWithRetries").mockResolvedValue({
      stdout: "Agent response here",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      attempts: 1,
    });
    const result = await handleSummon(
      { agent: "Claude", prompt: "review this code" },
      testConfig,
    );
    expect(result.isError).toBeFalsy();
    expect(result.text).toContain("Agent response here");
  });

  it("includes timeout notice with attempt count when agent times out", async () => {
    vi.spyOn(agents, "isCliAvailable").mockResolvedValue(true);
    vi.spyOn(agents, "spawnAgentWithRetries").mockResolvedValue({
      stdout: "partial output",
      stderr: "",
      exitCode: null,
      timedOut: true,
      attempts: 3,
    });
    const result = await handleSummon(
      { agent: "Claude", prompt: "slow task" },
      testConfig,
    );
    expect(result.text).toContain("partial output");
    expect(result.text).toContain("timed out");
    expect(result.text).toContain("3 attempts");
  });

  it("returns stderr on non-zero exit with attempt count", async () => {
    vi.spyOn(agents, "isCliAvailable").mockResolvedValue(true);
    vi.spyOn(agents, "spawnAgentWithRetries").mockResolvedValue({
      stdout: "",
      stderr: "something went wrong",
      exitCode: 1,
      timedOut: false,
      attempts: 3,
    });
    const result = await handleSummon(
      { agent: "Codex", prompt: "fail" },
      testConfig,
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("something went wrong");
    expect(result.text).toContain("after 3 attempts");
  });

  it("omits attempt count on single-attempt failure", async () => {
    vi.spyOn(agents, "isCliAvailable").mockResolvedValue(true);
    vi.spyOn(agents, "spawnAgentWithRetries").mockResolvedValue({
      stdout: "",
      stderr: "spawn error",
      exitCode: null,
      timedOut: false,
      attempts: 1,
    });
    const result = await handleSummon(
      { agent: "Claude", prompt: "broken" },
      testConfig,
    );
    expect(result.text).not.toContain("attempts");
  });

  it("returns error when a requested file is missing", async () => {
    vi.spyOn(agents, "isCliAvailable").mockResolvedValue(true);
    const { readFile } = await import("node:fs/promises");
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
    const result = await handleSummon(
      { agent: "Claude", prompt: "review", files: ["missing.ts"] },
      testConfig,
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("missing.ts");
  });
});
