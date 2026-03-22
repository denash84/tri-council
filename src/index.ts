#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { handleSummon, handleListAgents } from "./tools.js";

async function main() {
  const config = await loadConfig();
  const agentNames = Object.keys(config.agents);

  const server = new McpServer({
    name: "tri-council",
    version: "0.1.0",
  });

  // Register summon tool
  server.tool(
    "summon",
    `Summon an AI agent to answer a question or review code. Available agents: ${agentNames.join(", ")}`,
    {
      agent: z.string().describe(`Agent name: ${agentNames.join(", ")}`),
      prompt: z.string().describe("The question or task for the agent"),
      files: z
        .array(z.string())
        .optional()
        .describe("File paths to include as context"),
      cwd: z
        .string()
        .optional()
        .describe("Working directory for the agent CLI"),
    },
    async ({ agent, prompt, files, cwd }) => {
      const result = await handleSummon({ agent, prompt, files, cwd }, config);
      return {
        content: [{ type: "text" as const, text: result.text }],
        isError: result.isError,
      };
    },
  );

  // Register list_agents tool
  server.tool(
    "list_agents",
    "List all configured agents and their availability",
    {},
    async () => {
      const text = await handleListAgents(config);
      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  // Start
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
