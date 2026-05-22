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

import { spawn } from 'child_process';
import { loadAgent } from './load.js';

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
  const claudePath = opts.claudePath || 'claude';
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
