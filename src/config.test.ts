import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig, DEFAULT_AGENTS } from "./config.js";
import { readFile } from "node:fs/promises";

vi.mock("node:fs/promises");

describe("loadConfig", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns default agents when no config file exists", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
    const config = await loadConfig();
    expect(config.agents).toEqual(DEFAULT_AGENTS);
    expect(Object.keys(config.agents)).toEqual(["Claude", "Codex", "Gemini"]);
    expect(config.timeout).toBe(300_000);
    expect(config.maxRetries).toBe(3);
  });

  it("merges user config over defaults", async () => {
    const userConfig = JSON.stringify({
      agents: {
        Gemini: {
          command: "custom-gemini",
          args: ["-p", "{prompt}"],
          role: "reviewer",
        },
      },
      timeout: 60000,
    });
    vi.mocked(readFile).mockResolvedValue(userConfig as any);
    const config = await loadConfig();
    expect(config.agents.Gemini.command).toBe("custom-gemini");
    expect(config.agents.Gemini.role).toBe("reviewer");
    expect(config.agents.Claude).toEqual(DEFAULT_AGENTS.Claude); // untouched
    expect(config.timeout).toBe(60000);
  });

  it("keeps default agent fields when user override is partial", async () => {
    const userConfig = JSON.stringify({
      agents: {
        Claude: {
          command: "custom-claude",
        },
      },
    });

    vi.mocked(readFile).mockResolvedValue(userConfig as any);
    const config = await loadConfig();

    expect(config.agents.Claude.command).toBe("custom-claude");
    expect(config.agents.Claude.args).toEqual(DEFAULT_AGENTS.Claude.args);
    expect(config.agents.Claude.role).toBe(DEFAULT_AGENTS.Claude.role);
  });

  it("falls back to defaults for invalid timeout and retry values", async () => {
    const userConfig = JSON.stringify({
      timeout: 0,
      maxRetries: -1,
    });

    vi.mocked(readFile).mockResolvedValue(userConfig as any);
    const config = await loadConfig();

    expect(config.timeout).toBe(300_000);
    expect(config.maxRetries).toBe(3);
  });

  it("ignores malformed config file and falls back to defaults", async () => {
    vi.mocked(readFile).mockResolvedValue("not valid json" as any);
    const config = await loadConfig();
    expect(config.agents).toEqual(DEFAULT_AGENTS);
  });
});
