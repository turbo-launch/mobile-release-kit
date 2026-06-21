#!/usr/bin/env node
/**
 * test-mcp-boot.js — boot the MCP server over stdio, run the real initialize +
 * tools/list handshake, and assert both tools are advertised. Exits non-zero on
 * failure so CI catches a broken server.  Run: node scripts/test-mcp-boot.js
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const server = path.join(__dirname, 'mcp-server.js');
const p = spawn('node', [server], { stdio: ['pipe', 'pipe', 'pipe'] });
let out = '';
p.stdout.on('data', (d) => { out += d; });
p.stderr.on('data', (d) => process.stderr.write('[srv] ' + d));

const send = (o) => p.stdin.write(JSON.stringify(o) + '\n');
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ci', version: '0' } } });
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

setTimeout(() => {
  p.kill();
  const tools = [...new Set((out.match(/"name":"(frame_screenshots|contact_sheet)"/g) || []))];
  if (tools.length >= 2) {
    console.log('✓ MCP server boots and advertises:', tools.map((t) => t.split('"')[3]).join(', '));
    process.exit(0);
  }
  console.error('✗ MCP boot check failed — tools advertised:', tools.join(', ') || 'none');
  process.exit(1);
}, 4000);
