/**
 * @module
 * @name        runner
 * @domain      agentkit
 * @does        Runs a single agent via claude --print, passing the system prompt via --system-prompt and user input via stdin.
 * @tags        runner, claude, spawn, prompt, agent, cli, subprocess
 * @exports     runAgent
 * @reuse-when  You need to invoke a single agent with input and capture its output
 * @complexity  simple
 * @install     import { runAgent } from './src/runner.js'
 */

import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadAgent } from './load.js';

/**
 * @contract
 * @role        query
 * @domain      agentkit
 * @does        Resolves the claude binary path: checks PATH, then falls back to VS Code extension directories.
 * @tags        claude, binary, path, resolve, vscode, extension, detect
 * @returns     {string} absolute path to the claude binary
 * @example     const claudePath = findClaudeBinary()
 * @reuse-when  You need to locate the claude CLI before spawning it
 * @complexity  simple
 * @throws      Error if claude cannot be found anywhere
 * @module      src/runner
 */
export function findClaudeBinary() {
  // 1. Already on PATH
  try {
    execFileSync('which', ['claude'], { stdio: 'pipe' });
    return 'claude';
  } catch {}

  // 2. VS Code extension (any version, any platform)
  const extDir = path.join(os.homedir(), '.vscode', 'extensions');
  if (fs.existsSync(extDir)) {
    const match = fs.readdirSync(extDir)
      .filter(d => d.startsWith('anthropic.claude-code-'))
      .sort()
      .reverse()[0]; // latest version first
    if (match) {
      const bin = path.join(extDir, match, 'resources', 'native-binary', 'claude');
      if (fs.existsSync(bin)) return bin;
    }
  }

  // 3. VS Code Insiders
  const insidersExtDir = path.join(os.homedir(), '.vscode-insiders', 'extensions');
  if (fs.existsSync(insidersExtDir)) {
    const match = fs.readdirSync(insidersExtDir)
      .filter(d => d.startsWith('anthropic.claude-code-'))
      .sort()
      .reverse()[0];
    if (match) {
      const bin = path.join(insidersExtDir, match, 'resources', 'native-binary', 'claude');
      if (fs.existsSync(bin)) return bin;
    }
  }

  throw new Error(
    'claude binary not found.\n\n' +
    'Fix options:\n' +
    '  1. Symlink it:  ln -s ~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude /usr/local/bin/claude\n' +
    '  2. Pass the path explicitly:  agentkit run <agent> --claude-path=/path/to/claude\n' +
    '  3. Set AGENTKIT_CLAUDE_PATH env var\n\n' +
    'Claude Code must be installed: https://claude.ai/code'
  );
}

/**
 * @contract
 * @role        coordinator
 * @domain      agentkit
 * @does        Runs a named agent against input text by spawning claude --print with the agent system prompt.
 * @tags        run, agent, claude, spawn, prompt, input, output, subprocess
 * @takes       {string} agentName — agent name slug (e.g. "prd-designer")
 * @takes       {string} input — the user input / brief to send
 * @takes       {{ verbose?: boolean, claudePath?: string }} opts — options
 * @returns     {Promise<string>} stdout from the claude CLI
 * @example     const prd = await runAgent('prd-designer', 'A pharmacy in Casablanca')
 * @reuse-when  You need to run any agent against a text input and capture the output
 * @complexity  simple
 * @throws      Error if claude CLI is not found or exits non-zero
 * @module      src/runner
 */
export async function runAgent(agentName, input, opts = {}) {
  const agent = loadAgent(agentName, opts.agentsDir);
  const claudePath = opts.claudePath
    || process.env.AGENTKIT_CLAUDE_PATH
    || findClaudeBinary();
  const verbose = opts.verbose || false;

  if (verbose) {
    process.stderr.write(`[agentkit] running agent: ${agent.name} (${agent.domain})\n`);
    process.stderr.write(`[agentkit] input length: ${input.length} chars\n`);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    const errChunks = [];

    // --system-prompt carries the agent definition; user input goes via stdin
    const proc = spawn(claudePath, [
      '--print',
      '--output-format', 'text',
      '--system-prompt', agent.prompt,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin.write(input);
    proc.stdin.end();

    proc.stdout.on('data', chunk => chunks.push(chunk));
    proc.stderr.on('data', chunk => {
      errChunks.push(chunk);
      if (verbose) process.stderr.write(chunk);
    });

    proc.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(`claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code`));
      } else {
        reject(err);
      }
    });

    proc.on('close', code => {
      const stdout = Buffer.concat(chunks).toString('utf8').trim();
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString('utf8').trim();
        reject(new Error(`claude exited ${code}\n${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}
