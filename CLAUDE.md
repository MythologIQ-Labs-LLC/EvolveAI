# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EvolveAI is an exploration into theoretical agentic memory architecture—a learning computer that evolves its own neural network-like memory structures. This is research-grade software focused on memory systems, not a chatbot or assistant.

**Vibe**: Adaptive, Accountable, Retrievable

## Anti-Goals

- **Not a chatbot/assistant** - Memory research, not conversational AI
- **Not cloud-dependent** - All core functionality operates locally
- **Not a static database** - Memory must evolve, decay, and restructure

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server (port 4000)
npm run test         # Run tests (Vitest)
npm run lint         # Lint
npm run build        # Production build
```

## Architecture

See [docs/ARCHITECTURE_PLAN.md](docs/ARCHITECTURE_PLAN.md) for the full contract.

### Memory Subsystems

| Subsystem | Purpose | Location |
|-----------|---------|----------|
| **Tiers** | STM/LTM with promotion/decay | `src/core/tiers/` |
| **Graph** | Associative memory network | `src/core/graph/` |
| **Chain** | Cryptographic integrity ledger | `src/core/chain/` |
| **Memory** | Encoding/decoding/decay | `src/core/memory/` |

### Data Flow

```
[Input] -> Encoder -> TierRouter -> [STM|LTM] -> GraphNode -> HashChain
[Query] -> Decoder -> GraphTraversal -> TierLookup -> DecayAdjust -> Result
[Tick]  -> DecayEngine -> Promotion -> Consolidation -> HashChain
```

## QoreLogic A.E.G.I.S. Status

- **Genesis Hash**: `ece694ee280ee892649d195e6393e979cad072b076afa973816e925f01eb28b4`
- **Final Hash**: `78293bb1eef2fc17d7fbc325c7c8d639026306fe2a237ef0f7f7b21f446a475f`
- **Risk Grade**: L3 (cryptographic memory integrity)
- **Lifecycle**: RELEASED (v1.0.0)
- **License**: Apache-2.0

## Legacy Context

The `_archive/` directory and existing `components/ui/` contain UI components from a previous AI assistant design. These may be retained and adapted for memory visualization, but the core architecture is new.

## Path Aliases

- `@/components` → `./components`
- `@/lib` → `./lib`
- `@/hooks` → `./hooks`
