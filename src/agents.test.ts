import { describe, it, expect } from "vitest";
import { buildPrompt, isCliAvailable, spawnAgent } from "./agents.js";

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
