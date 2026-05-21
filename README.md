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
agentkit run summarizer --input="Your text here"

# Pipe input from a file
agentkit run summarizer --input-file=notes.txt

# Pipe from stdin
cat meeting-notes.txt | agentkit run summarizer

# Save output to file
agentkit run summarizer --input-file=notes.txt --output-file=summary.md

# Chain agents manually
agentkit chain agent-a,agent-b --input="Your input"

# Chain agents automatically (follows chain_next links in frontmatter)
agentkit chain agent-a --auto --input="Your input"

# Verbose mode (debug info on stderr)
agentkit run summarizer --input="..." --verbose
```

---

## Agent file format

```markdown
---
name: my-agent
domain: my-domain
description: One-line description shown in agentkit list
input: plain-English description of expected input
output: plain-English description of expected output
tags: [tag1, tag2]
chain_next: next-agent-slug   # optional — enables --auto chaining
---

Your system prompt goes here.

Everything below the frontmatter is sent to claude as the system prompt.
The user's input is appended after a --- separator.
```

---

## Available agents

### `generic/summarizer`

Summarizes any text into a structured brief with key points, decisions, and open questions.

```bash
cat meeting-notes.txt | agentkit run summarizer
agentkit run summarizer --input-file=document.txt --output-file=summary.md
```

---

## Using agents from an external directory

Agents don't have to live inside the agentkit repo. Point at any directory:

```bash
# Use agents from another project
agentkit list --agents-dir=~/myproject/agents
agentkit run my-agent --agents-dir=~/myproject/agents --input="..."
agentkit chain my-agent --auto --agents-dir=~/myproject/agents --input="..."

# Or set it once via env var
export AGENTKIT_AGENTS_DIR=~/myproject/agents
agentkit list
agentkit run my-agent --input="..."
```

This lets domain-specific agent libraries live in their own repos (versioned, reviewed, tested) while agentkit stays generic.

## Writing your own agents

1. Create `agents/<domain>/<name>.md` — anywhere, not just inside agentkit
2. Add YAML frontmatter (`name`, `domain`, `description`, `input`, `output`, `tags`)
3. Write your system prompt below the frontmatter
4. Run `agentkit list --agents-dir=<your-dir>` to verify it appears
5. Run `agentkit run <name> --agents-dir=<your-dir> --input="..."` to test it

To chain agents, add `chain_next: <next-agent-name>` to the first agent's frontmatter.

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
    generic/
      summarizer.md   ← example agent
    <your-domain>/    ← add your own agents here
```

---

## Why no API?

Claude Code's `claude --print` mode runs a full claude session from the CLI using your existing subscription. No API key, no per-token billing, no SDK to configure.

The tradeoff: each agent call starts a new claude session (stateless). For prompt→response agents, this is fine — and it means any team member with Claude Code installed can run the pipeline.
