/**
 * @module
 * @name        chain
 * @domain      agentkit
 * @does        Runs a sequence of agents where each agent's output becomes the next agent's input.
 * @tags        chain, pipeline, sequence, agents, compose, output, input
 * @exports     chainAgents
 * @reuse-when  You need to pipe multiple agents in sequence (e.g. designer → reviewer)
 * @complexity  simple
 * @install     import { chainAgents } from './src/chain.js'
 */

import { runAgent } from './runner.js';

/**
 * @contract
 * @role        coordinator
 * @domain      agentkit
 * @does        Runs a list of agent names in sequence, piping each output as the next agent's input.
 * @tags        chain, sequence, agents, pipeline, compose, run, input, output
 * @takes       {string[]} agentNames — ordered list of agent slugs
 * @takes       {string} initialInput — the first agent's input
 * @takes       {{ verbose?: boolean, onStep?: Function }} opts — options
 * @returns     {Promise<{ steps: Array<{ agent, input, output }>, final: string }>} all steps + final output
 * @example     const result = await chainAgents(['prd-designer', 'prd-reviewer'], 'A pharmacy in Casablanca')
 * @reuse-when  You need to run a multi-agent pipeline and capture every intermediate result
 * @complexity  simple
 * @throws      Error if any agent in the chain fails
 * @module      src/chain
 */
export async function chainAgents(agentNames, initialInput, opts = {}) {
  const steps = [];
  let currentInput = initialInput;

  for (const agentName of agentNames) {
    if (opts.verbose) {
      process.stderr.write(`\n[agentkit] chain step: ${agentName}\n`);
    }

    const output = await runAgent(agentName, currentInput, opts);

    const step = { agent: agentName, input: currentInput, output };
    steps.push(step);

    if (opts.onStep) opts.onStep(step, steps.length - 1);

    currentInput = output;
  }

  return { steps, final: currentInput };
}

/**
 * @contract
 * @role        query
 * @domain      agentkit
 * @does        Resolves a chain of agents by following chain_next frontmatter links from a starting agent.
 * @tags        chain, resolve, chain_next, frontmatter, auto, discover
 * @takes       {string} startAgent — first agent name slug
 * @takes       {Function} loadFn — loadAgent function (injected to avoid circular dep)
 * @returns     {string[]} ordered agent names including startAgent and all chain_next links
 * @example     const chain = resolveChain('prd-designer', loadAgent)
 * @reuse-when  You need to auto-discover a chain from a starting agent's chain_next metadata
 * @complexity  simple
 * @module      src/chain
 */
export function resolveChain(startAgent, loadFn) {
  const chain = [];
  const visited = new Set();
  let current = startAgent;

  while (current && !visited.has(current)) {
    visited.add(current);
    chain.push(current);
    try {
      const agent = loadFn(current);
      current = agent.chainNext || null;
    } catch {
      break;
    }
  }

  return chain;
}
