#!/usr/bin/env node

/**
 * agentkit CLI
 * Usage:
 *   agentkit list [--domain=<domain>]
 *   agentkit run <agent> [--input=<text>] [--input-file=<path>] [--output-file=<path>] [--verbose]
 *   agentkit chain <agent> [--input=<text>] [--input-file=<path>] [--output-file=<path>] [--verbose] [--auto]
 *   agentkit chain <agent1,agent2,...> [same flags]
 */

import fs from 'fs';
import readline from 'readline';
import { listAgents, loadAgent } from '../src/load.js';
import { runAgent } from '../src/runner.js';
import { chainAgents, resolveChain } from '../src/chain.js';

const args = process.argv.slice(2);
const command = args[0];

function parseFlags(args) {
  const flags = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        flags[arg.slice(2)] = true;
      } else {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      }
    }
  }
  return flags;
}

async function readInput(flags) {
  if (flags['input-file']) {
    return fs.readFileSync(flags['input-file'], 'utf8').trim();
  }
  if (flags.input) {
    return flags.input;
  }
  if (!process.stdin.isTTY) {
    return new Promise(resolve => {
      const chunks = [];
      process.stdin.on('data', c => chunks.push(c));
      process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim()));
    });
  }
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    const lines = [];
    process.stderr.write('Input (press Ctrl+D when done):\n');
    rl.on('line', l => lines.push(l));
    rl.on('close', () => resolve(lines.join('\n').trim()));
  });
}

function writeOutput(text, flags) {
  if (flags['output-file']) {
    fs.writeFileSync(flags['output-file'], text + '\n', 'utf8');
    process.stderr.write(`[agentkit] output saved to ${flags['output-file']}\n`);
  } else {
    process.stdout.write(text + '\n');
  }
}

function printAgentTable(agents) {
  const maxName = Math.max(4, ...agents.map(a => a.name.length));
  const maxDomain = Math.max(6, ...agents.map(a => a.domain.length));
  const maxDesc = Math.max(11, ...agents.map(a => a.description.length));

  const row = (n, d, desc, next) =>
    `  ${n.padEnd(maxName)}  ${d.padEnd(maxDomain)}  ${desc.padEnd(Math.min(maxDesc, 60))}  ${next || ''}`;

  console.log(row('NAME', 'DOMAIN', 'DESCRIPTION', 'CHAIN →'));
  console.log('  ' + '-'.repeat(maxName + maxDomain + Math.min(maxDesc, 60) + 20));
  for (const a of agents) {
    console.log(row(a.name, a.domain, a.description.slice(0, 60), a.chainNext || ''));
  }
}

// ─── commands ──────────────────────────────────────────────────────────────────

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(`
agentkit — run Claude agents from the CLI without the Anthropic API

USAGE
  agentkit list [--domain=<domain>]
  agentkit run <agent> [--input=<text>] [--input-file=<path>] [--output-file=<path>] [--verbose]
  agentkit chain <agent> [--auto] [--input=<text>] [--input-file=<path>] [--output-file=<path>] [--verbose]
  agentkit chain <a,b,c> [--input=<text>] [--input-file=<path>] [--output-file=<path>] [--verbose]

COMMANDS
  list      Show all available agents
  run       Run a single agent
  chain     Run multiple agents in sequence (output of each → input of next)

FLAGS
  --input=<text>         Input text for the agent
  --input-file=<path>    Read input from a file
  --output-file=<path>   Write output to a file instead of stdout
  --verbose              Show debug info on stderr
  --auto                 For chain: auto-follow chain_next links from starting agent
  --domain=<domain>      For list: filter by domain

EXAMPLES
  agentkit list
  agentkit run prd-designer --input="A pharmacy in Casablanca"
  agentkit chain prd-designer --auto --input="A pharmacy in Casablanca"
  agentkit chain prd-designer,prd-reviewer --input="A pharmacy in Casablanca"
  echo "A bakery in Rabat" | agentkit run prd-designer
`);
  process.exit(0);
}

if (command === 'list') {
  const flags = parseFlags(args.slice(1));
  let agents = listAgents();
  if (flags.domain) agents = agents.filter(a => a.domain === flags.domain);
  if (agents.length === 0) {
    console.log('No agents found.');
  } else {
    console.log(`\n${agents.length} agent(s) available:\n`);
    printAgentTable(agents);
    console.log('');
  }
  process.exit(0);
}

if (command === 'run') {
  const agentName = args[1];
  if (!agentName) {
    process.stderr.write('Usage: agentkit run <agent>\n');
    process.exit(1);
  }
  const flags = parseFlags(args.slice(2));

  (async () => {
    try {
      const input = await readInput(flags);
      if (!input) {
        process.stderr.write('No input provided.\n');
        process.exit(1);
      }
      const output = await runAgent(agentName, input, { verbose: !!flags.verbose });
      writeOutput(output, flags);
    } catch (e) {
      process.stderr.write(`Error: ${e.message}\n`);
      process.exit(1);
    }
  })();
}

else if (command === 'chain') {
  const chainArg = args[1];
  if (!chainArg) {
    process.stderr.write('Usage: agentkit chain <agent> [--auto] or agentkit chain <a,b,c>\n');
    process.exit(1);
  }
  const flags = parseFlags(args.slice(2));

  (async () => {
    try {
      let agentNames;
      if (chainArg.includes(',')) {
        agentNames = chainArg.split(',').map(s => s.trim());
      } else if (flags.auto) {
        agentNames = resolveChain(chainArg, loadAgent);
        if (flags.verbose) {
          process.stderr.write(`[agentkit] resolved chain: ${agentNames.join(' → ')}\n`);
        }
      } else {
        agentNames = [chainArg];
      }

      const input = await readInput(flags);
      if (!input) {
        process.stderr.write('No input provided.\n');
        process.exit(1);
      }

      const result = await chainAgents(agentNames, input, {
        verbose: !!flags.verbose,
        onStep: (step, i) => {
          if (flags.verbose) {
            process.stderr.write(`[agentkit] step ${i + 1}/${agentNames.length} (${step.agent}) complete — ${step.output.length} chars\n`);
          }
        },
      });

      writeOutput(result.final, flags);
    } catch (e) {
      process.stderr.write(`Error: ${e.message}\n`);
      process.exit(1);
    }
  })();
}

else {
  process.stderr.write(`Unknown command: ${command}\nRun "agentkit --help" for usage.\n`);
  process.exit(1);
}
