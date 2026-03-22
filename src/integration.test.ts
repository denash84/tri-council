import { describe, it, expect } from "vitest";
import { handleSummon, handleListAgents } from "./tools.js";
import type { Config } from "./config.js";

// Use real 'echo' as a mock agent CLI
const echoConfig: Config = {
  agents: {
    EchoBot: {
      command: "echo",
      args: ["{prompt}"],
      role: "tester",
    },
    MissingBot: {
      command: "nonexistent-cli-xyz-999",
      args: ["{prompt}"],
      role: "ghost",
    },
  },
  timeout: 5000,
  maxRetries: 3,
};

describe("integration: handleSummon with real subprocess", () => {
  it("spawns echo and returns the prompt as output", async () => {
    const result = await handleSummon(
      { agent: "EchoBot", prompt: "Hello from test" },
      echoConfig,
    );
    expect(result.isError).toBeFalsy();
    expect(result.text.trim()).toBe("Hello from test");
  });

  it("fails gracefully for missing CLI", async () => {
    const result = await handleSummon(
      { agent: "MissingBot", prompt: "hi" },
      echoConfig,
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("not found on PATH");
  });
});

describe("integration: handleListAgents", () => {
  it("shows EchoBot as available and MissingBot as not found", async () => {
    const text = await handleListAgents(echoConfig);
    expect(text).toContain("EchoBot");
    expect(text).toContain("available");
    expect(text).toContain("MissingBot");
    expect(text).toContain("not found");
  });
});
