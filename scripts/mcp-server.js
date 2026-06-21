#!/usr/bin/env node
/**
 * mcp-server.js — expose the kit's screenshot tools over stdio MCP, so agents
 * that prefer a typed tool surface (or that gate the bash tool, e.g. unattended
 * cloud agents) can call them without shelling out manually.
 *
 * Most agents can just run the scripts via their bash tool (see AGENTS.md) —
 * that's lighter. Use this server only when a typed/guard-railed surface helps.
 *
 *   npm i @modelcontextprotocol/sdk zod
 *   node scripts/mcp-server.js          # stdio transport
 *
 * Wire it up via .mcp.json (Claude/Cursor/Gemini/Cline/Windsurf), .vscode/mcp.json
 * (Copilot, key "servers"), or ~/.codex/config.toml ([mcp_servers.*]).
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');

const run = promisify(execFile);
const HERE = __dirname;

// NEVER write to stdout — that's the MCP channel. Logs go to stderr.
function ok(text) { return { content: [{ type: 'text', text: text || 'Done.' }] }; }
function err(text) { return { content: [{ type: 'text', text }], isError: true }; }

async function node(script, args) {
  try {
    const { stdout, stderr } = await run('node', [path.join(HERE, script), ...args], { cwd: process.cwd() });
    return ok((stdout || '') + (stderr ? `\n[stderr] ${stderr}` : ''));
  } catch (e) {
    return err(`FAILED (${e.code ?? '?'}): ${e.stderr || e.message}`);
  }
}

const server = new McpServer({ name: 'mobile-release-kit', version: '0.1.0' });

server.registerTool(
  'frame_screenshots',
  {
    description:
      'Render raw app screenshots into framed App Store / Play Store marketing images at exact store pixel sizes. Needs a frames config (see templates/frames.config.json) and a dir of raw <screen-key>.png files.',
    inputSchema: {
      configPath: z.string().describe('Path to the frames config JSON'),
      rawDir: z.string().describe('Directory of raw <screen-key>.png screenshots'),
      outDir: z.string().describe('Output directory for framed NN-<key>.png images'),
      device: z
        .enum(['iphone-6.9', 'iphone-6.5', 'ipad-13', 'android-phone', 'android-tablet'])
        .describe('Target store device size'),
    },
  },
  ({ configPath, rawDir, outDir, device }) =>
    node('frame-screenshots.js', [configPath, rawDir, outDir, device])
);

server.registerTool(
  'contact_sheet',
  {
    description: 'Tile every PNG in a directory into one review image, to judge a screenshot set at a glance.',
    inputSchema: {
      dir: z.string().describe('Directory of PNGs to tile'),
      out: z.string().describe('Output PNG path'),
      cols: z.number().int().min(1).max(12).default(5).describe('Columns in the grid'),
    },
  },
  ({ dir, out, cols }) => node('contact-sheet.js', [dir, out, String(cols)])
);

(async () => {
  await server.connect(new StdioServerTransport());
  console.error('mobile-release-kit MCP server ready (stdio)');
})().catch((e) => {
  console.error('mobile-release-kit MCP server failed:', e);
  process.exit(1);
});
