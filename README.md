# agentkit

Lightweight CLI framework for running Claude agent prompts — no Anthropic API key, no HTTP, no cost beyond your existing `claude` CLI session.

Agents are markdown files with YAML frontmatter. You run them with one command.

---

## How it works

1. Each agent is a `.md` file with a system prompt and frontmatter metadata
2. `agentkit run` pipes `<system_prompt>\n---\n<your_input>` to `claude --print`
3. stdout is the agent's response — pipe it anywhere
4. Agents can declare `chain_next` to form pipelines

No API key. No SDK. No cost beyond your existing Claude Code subscription.

---

## Install

```bash
git clone git@github.com:techiediaries/agentkit.git
cd agentkit
npm link   # makes `agentkit` available globally
```

Requires `claude` CLI installed: `npm install -g @anthropic-ai/claude-code`

---

## Usage

```bash
# List all available agents
agentkit list

# Run a single agent
agentkit run prd-designer --input="A pharmacy in Casablanca"

# Pipe input from a file
agentkit run prd-designer --input-file=brief.txt

# Pipe from stdin
echo "A bakery in Rabat" | agentkit run prd-designer

# Save output to file
agentkit run prd-designer --input="A pharmacy in Casablanca" --output-file=prd.json

# Chain agents manually
agentkit chain prd-designer,prd-reviewer --input="A pharmacy in Casablanca"

# Chain agents automatically (follows chain_next links in frontmatter)
agentkit chain prd-designer --auto --input="A pharmacy in Casablanca"

# Full pipeline: design → review → save
agentkit chain prd-designer,prd-reviewer \
  --input="A pharmacy in Casablanca" \
  --output-file=review.json \
  --verbose
```

---

## Agent file format

```markdown
---
name: my-agent
domain: my-domain
description: One-line description shown in agentkit list
input: plain-English brief
output: JSON or structured text
tags: [tag1, tag2]
chain_next: next-agent-slug   # optional — enables --auto chaining
---

Your system prompt goes here.

Everything in this file below the --- frontmatter is sent to claude as the system prompt.
The user's input is appended after a --- separator.
```

---

## Available agents

### `darjs/prd-designer`

Designs complete PRD documents for Moroccan SMB apps buildable with DarJS.

- **Input:** plain-English brief (business type, city, sector)
- **Output:** structured JSON PRD — models, scenarios, roles, theme, regulatory
- **Chains to:** `prd-reviewer`

```bash
agentkit run prd-designer --input="A restaurant in Marrakech"
```

### `darjs/prd-reviewer`

Reviews a DarJS PRD for gaps that would block a Moroccan business owner from achieving their daily goals.

- **Input:** PRD JSON from `prd-designer`
- **Output:** structured review — gaps, missing scenarios, ambiguities, pass/fail verdict

```bash
agentkit run prd-designer --input="A restaurant in Marrakech" | agentkit run prd-reviewer
```

Or run both in one command:

```bash
agentkit chain prd-designer --auto --input="A restaurant in Marrakech" --output-file=review.json
```

---

## Writing your own agents

1. Create a file in `agents/<domain>/<name>.md`
2. Add YAML frontmatter (name, domain, description, input, output, tags)
3. Write your system prompt below the frontmatter
4. Run `agentkit list` to verify it appears
5. Run `agentkit run <name> --input="..."` to test it

To chain agents, add `chain_next: <next-agent-name>` to the frontmatter of the first agent.

---

## Project structure

```
agentkit/
  bin/
    agentkit.js       ← CLI entry point
  src/
    load.js           ← discovers + parses agent files
    runner.js         ← spawns claude --print with agent prompt
    chain.js          ← sequences agents, resolves chain_next links
  agents/
    darjs/
      prd-designer.md
      prd-reviewer.md
    generic/          ← general-purpose agents (add your own)
```

---

## Why no API?

Claude Code's `claude --print` mode runs a full claude session from the CLI, using your existing subscription. No API key, no per-token billing, no SDK to configure.

The tradeoff: each agent call starts a new claude session (no persistent memory between calls). For stateless prompt→response agents, this is fine — and it means any team member with Claude Code installed can run the pipeline.
