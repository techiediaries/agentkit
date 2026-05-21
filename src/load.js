/**
 * @module
 * @name        load
 * @domain      agentkit
 * @does        Discovers and parses agent markdown files from the agents/ directory tree.
 * @tags        agent, load, parse, frontmatter, discover, markdown
 * @exports     loadAgent, listAgents
 * @reuse-when  You need to find or read agent definitions by name or domain
 * @complexity  simple
 * @install     import { loadAgent, listAgents } from './src/load.js'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.join(__dirname, '..', 'agents');

/**
 * @contract
 * @role        transformer
 * @domain      agentkit
 * @does        Parses YAML frontmatter and body from a markdown agent file string.
 * @tags        parse, frontmatter, yaml, markdown, agent
 * @takes       {string} content — raw markdown file content
 * @returns     {{ meta: Object, prompt: string }} parsed frontmatter and prompt body
 * @example     const { meta, prompt } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
 * @reuse-when  You need to split frontmatter from prompt body in an agent file
 * @complexity  simple
 * @module      src/load
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, prompt: content };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
    }
    meta[key] = val;
  }
  return { meta, prompt: match[2].trim() };
}

/**
 * @contract
 * @role        query
 * @domain      agentkit
 * @does        Loads and parses an agent file by name, searching all domain subdirectories.
 * @tags        load, agent, find, name, file, parse
 * @takes       {string} name — agent name slug (e.g. "prd-designer" or "darjs/prd-designer")
 * @returns     {{ name, domain, description, prompt, meta, filePath }} agent definition
 * @example     const agent = loadAgent('prd-designer')
 * @reuse-when  You need to load a specific agent by name before running it
 * @complexity  simple
 * @throws      Error if agent not found
 * @module      src/load
 */
export function loadAgent(name) {
  const candidates = [];

  if (name.includes('/')) {
    candidates.push(path.join(AGENTS_DIR, `${name}.md`));
  } else {
    const domains = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    for (const domain of domains) {
      candidates.push(path.join(AGENTS_DIR, domain, `${name}.md`));
    }
    candidates.push(path.join(AGENTS_DIR, `${name}.md`));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf8');
      const { meta, prompt } = parseFrontmatter(content);
      return {
        name: meta.name || name,
        domain: meta.domain || 'generic',
        description: meta.description || '',
        chainNext: meta.chain_next || null,
        chainPrev: meta.chain_prev || null,
        tags: meta.tags || [],
        input: meta.input || 'plain text',
        output: meta.output || 'plain text',
        prompt,
        meta,
        filePath: candidate,
      };
    }
  }

  throw new Error(`Agent not found: ${name}\nSearched:\n${candidates.map(c => '  ' + c).join('\n')}`);
}

/**
 * @contract
 * @role        query
 * @domain      agentkit
 * @does        Returns all agent definitions from the agents/ directory tree, grouped by domain.
 * @tags        list, agents, discover, directory, domain
 * @returns     {Array<{ name, domain, description, tags, chainNext, filePath }>} all agents
 * @example     const agents = listAgents()
 * @reuse-when  You need to show available agents or search by tag/domain
 * @complexity  simple
 * @module      src/load
 */
export function listAgents() {
  const agents = [];

  function walk(dir, domain) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), entry.name);
      } else if (entry.name.endsWith('.md')) {
        const filePath = path.join(dir, entry.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const { meta } = parseFrontmatter(content);
        agents.push({
          name: meta.name || entry.name.replace('.md', ''),
          domain: meta.domain || domain || 'generic',
          description: meta.description || '',
          tags: meta.tags || [],
          chainNext: meta.chain_next || null,
          input: meta.input || 'plain text',
          output: meta.output || 'plain text',
          filePath,
        });
      }
    }
  }

  walk(AGENTS_DIR, 'generic');
  return agents;
}
