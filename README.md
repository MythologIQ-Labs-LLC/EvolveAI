# EvolveAI: Autopoietic Memory System

An exploration into theoretical agentic memory architecture—a learning computer that evolves its own neural network-like memory structures rather than serving as a static assistant.

**Current version**: v6.1.0 (see [docs/META_LEDGER.md](docs/META_LEDGER.md))

## Overview

EvolveAI implements the **Autopoietic Memory Theory**, a novel approach to machine cognition that treats memory as a self-maintaining, self-organizing system. Unlike traditional databases or retrieval-augmented generation (RAG) systems, EvolveAI's memory actively evolves, decays, and restructures based on usage patterns.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Adaptive** | Memory that learns, evolves, and restructures based on usage patterns |
| **Accountable** | Every memory operation is traceable with cryptographic audit trails |
| **Retrievable** | Intelligent recall mechanisms that surface relevant memories contextually |

### Anti-Goals

This project is explicitly **NOT**:
- A chatbot or assistant
- Cloud-dependent (operates entirely locally)
- A static database (memory must evolve, decay, and restructure)

---

## What's in this repository

The project has been rewritten in Rust (v3.0 onward); the original TypeScript prototype is kept frozen for reference.

| Component | Location | State |
|-----------|----------|-------|
| **Rust core** — thermodynamic memory model: decay, trust scoring, zero-trust crystallization, hash-chained ledger | `crates/evolve-core` | Active (the product) |
| **CLI** — 9 commands over persistent state in `~/.evolve/memory.json` | `crates/evolve-cli` | Active |
| **Desktop shell** — Tauri 2 app exposing the memory commands | `src-tauri` (frontend entry in `ui/`) | Active; frontend build wiring incomplete (see [REPO_REVIEW-2026-08-11](docs/REPO_REVIEW-2026-08-11.md)) |
| **Legacy TypeScript prototype** (v1.0–v2.1) | `src/`, `lib/`, `components/` | Frozen since 2026-03-18; 164 vitest tests still pass; superseded by the Rust rewrite |
| **Vendored dependency** — GG-CORE runtime (git submodule) | `vendor/GG-CORE` | Required path dependency |

---

## Getting Started

### Clone

The Cargo workspace has a path dependency on `vendor/GG-CORE/core-runtime`, so the submodule is **required** — a clone without it will not build.

```bash
git clone --recurse-submodules https://github.com/MythologIQ-Labs-LLC/EvolveAI.git
cd EvolveAI

# If you already cloned without submodules:
git submodule update --init --recursive
```

### Rust core and CLI

```bash
# Run the test suites
cargo test -p evolve-core -p evolve-cli

# Run the CLI (state persists to ~/.evolve/memory.json)
cargo run -p evolve-cli -- help
cargo run -p evolve-cli -- add "Important fact to remember"
cargo run -p evolve-cli -- search "important fact"
```

CLI commands:

| Command | Purpose |
|---------|---------|
| `add <content...>` | Store a memory, print its address |
| `search <query...>` | Find memories by relevance |
| `forget <address>` | Delete a memory by address |
| `feedback <address>` | Pin fibers (CrossReference event) |
| `dispute <address> [sev]` | Inject entropy (default severity 0.5) |
| `approve <address>` | Approve crystallization (L2→L3) |
| `profile` | Show cognitive profile summary |
| `slo` | Show SLO report |
| `ingest <file>` | Ingest a text file as memory chunks |

### Desktop app (Tauri 2)

Building the Tauri shell on Linux requires the GTK/WebKit system libraries, e.g. on Debian/Ubuntu:

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  build-essential curl wget file libssl-dev libayatana-appindicator3-dev
```

Then build the shell crate with `cargo build -p evolve-app`. Note: the frontend dev/build wiring referenced by `tauri.conf.json` is currently incomplete — see the [repository review](docs/REPO_REVIEW-2026-08-11.md) for status and roadmap.

### Legacy TypeScript prototype

The frozen v1–v2 prototype still runs its own test suite:

```bash
npm install
npm test          # 164 vitest tests
```

(`npm run build` / `npm run lint` are currently broken on the legacy side; see the repository review.)

---

## Architecture

### Neural Net Processor

The **Neural Net Processor** is the computational engine implementing the Autopoietic Memory Theory:

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEURAL NET PROCESSOR                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               LIFECYCLE ORCHESTRATOR                        │ │
│  │  GROUNDING → SEMANTIC_PAUSE → ACTIVE_FLOW → DETACHMENT     │ │
│  │                              ↓                              │ │
│  │                       REM_SYNTHESIS                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌──────────────────────────┴──────────────────────────────┐   │
│  │                   PROCESSING CORE                        │   │
│  │  ┌─────────┐    ┌──────────┐    ┌─────────┐             │   │
│  │  │ ENCODER │ ←→ │ TIER MoE │ ←→ │ DECODER │             │   │
│  │  └─────────┘    └──────────┘    └─────────┘             │   │
│  │                                                          │   │
│  │  ┌──────────────┐    ┌─────────────────────┐            │   │
│  │  │ DECAY ENGINE │    │ SHADOW GENOME       │            │   │
│  │  │    (CMHL)    │    │   INTERCEPTOR       │            │   │
│  │  └──────────────┘    └─────────────────────┘            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ════════════════════════════╪═══════════════════════════════   │
│                         MEMORY BUS                               │
│  ════════════════════════════╪═══════════════════════════════   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │ L1 TRANSIENT│     │ L2 TEMPORAL │     │  L3 UOR     │       │
│  │    CACHE    │     │    GRAPH    │     │   VAULT     │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 5-Phase Metabolic Lifecycle

1. **GROUNDING** — Establish session context, load soul file, allocate fiber budget
2. **SEMANTIC_PAUSE** — Safety check against Shadow Genome before execution
3. **ACTIVE_FLOW** — Execute operations with full pipeline tracing
4. **DETACHMENT** — Clear transient state, checkpoint L2 graph
5. **REM_SYNTHESIS** — Learn from traces, crystallize stable memories to L3

### Tri-Layer Memory System

| Tier | Name | Characteristics | Decay Rate |
|------|------|-----------------|------------|
| L1 | Transient Cache | Fast vector-based, TTL eviction | λ = 0.1 (aggressive) |
| L2 | Temporal Graph | CMHL decay, edge traversal, semantic relationships | λ = 0.001 (moderate) |
| L3 | UOR Vault | Immutable hash chain, O(1) lookup, cryptographic verification | λ = 0 (immortal) |

Memories are routed to tiers by the Memory Tier Score (MTS):

```
MTS = (S × Ws) + (A × Wa) + (P × Wp) - (C × Wc)
```

with **S** = sensitivity, **A** = accuracy requirement, **P** = privilege level, **C** = compute constraint. MTS > 0.8 → L3, MTS > 0.3 → L2, otherwise L1.

### CMHL: Cryptographic Memory Half-Life

Decay is computed lazily on retrieval using exponential decay:

```
w_current = w₀ × e^(-λt)
```

where `w₀` is the initial weight (salience at encoding), `λ` the tier-specific decay constant, and `t` the time since last access.

### Shadow Genome

A negative-constraint immune system that blocks execution when intent matches known failure patterns:

- Tracks failure categories: `COMPLEXITY_VIOLATION`, `HALLUCINATION`, `SECURITY_REGRESSION`, etc.
- Uses cosine similarity against embedded failure traces
- Provides safety verdicts: `PASS` or `BLOCK`

---

## Project Status

- **Lifecycle**: RELEASED (v6.1.0), governed by the QoreLogic A.E.G.I.S. meta-ledger (81 chained entries).
- **Backlog**: 7 of 14 items complete, 1 partial, 6 open — next up is **BL-001 (deterministic policy gate)**, which unblocks BL-002/003/007. See [docs/BACKLOG.md](docs/BACKLOG.md).
- **Known gaps and roadmap**: see [docs/REPO_REVIEW-2026-08-11.md](docs/REPO_REVIEW-2026-08-11.md).

---

## Documentation

| Document | Description |
|----------|-------------|
| [CONCEPT.md](docs/CONCEPT.md) | Project DNA — Why, Vibe, Anti-Goals |
| [ARCHITECTURE_PLAN.md](docs/ARCHITECTURE_PLAN.md) | Original architecture blueprint |
| [AUTOPOIETIC_MEMORY_THEORY.md](docs/AUTOPOIETIC_MEMORY_THEORY.md) | Theoretical foundations |
| [NEURAL_NET_PROCESSOR_DESIGN.md](docs/NEURAL_NET_PROCESSOR_DESIGN.md) | Detailed design specification |
| [SHADOW_GENOME.md](docs/SHADOW_GENOME.md) | Failure-pattern immune system |
| [PRISM_UOR_MDK_SUMMARY.md](docs/PRISM_UOR_MDK_SUMMARY.md) | UOR identity algebra summary |
| [BACKLOG.md](docs/BACKLOG.md) | Research-sourced backlog with status table |
| [SYSTEM_STATE.md](docs/SYSTEM_STATE.md) | Sealed system state snapshot |
| [META_LEDGER.md](docs/META_LEDGER.md) | QoreLogic governance chain (do not hand-edit) |
| [REPO_REVIEW-2026-08-11.md](docs/REPO_REVIEW-2026-08-11.md) | Product-readiness review and roadmap |
| `docs/plan-*.md` | Per-release implementation plans (v2 → v6.1) |
| `docs/Research/` | Comparative research artifacts |

---

## Agent Memory Alignment

This repository implements and experiments with **memory metabolism** — lifecycle orchestration, decay (CMHL), tier routing, and REM-synthesis consolidation — within the [Agent Memory](https://github.com/MythologIQ-Labs-LLC/agent-memory) reference architecture. EvolveAI's Autopoietic Memory Theory remains its own theoretical framework; this alignment maps responsibilities, it does not merge doctrines.

Canonical doctrine this work maps to:

- [Lifecycle state machine](https://github.com/MythologIQ-Labs-LLC/agent-memory/blob/main/docs/02-lifecycle-state-machine.md)
- [Forgetting, consolidation, and memory metabolism](https://github.com/MythologIQ-Labs-LLC/agent-memory/blob/main/docs/21-forgetting-consolidation-and-memory-metabolism.md)
- [PAMA — mutation authority](https://github.com/MythologIQ-Labs-LLC/agent-memory/blob/main/docs/pama/README.md)
- [ADR-020 — governed uncertainty](https://github.com/MythologIQ-Labs-LLC/agent-memory/blob/main/docs/adr/ADR-020-probabilistic-discovery-deterministic-governance.md)
- [Conformance test plan](https://github.com/MythologIQ-Labs-LLC/agent-memory/blob/main/docs/06-conformance-test-plan.md)

The governing boundary: EvolveAI's learned and heuristic signals may **propose** decay, retention, consolidation, or promotion. They do not self-authorize irreversible or canonical state changes — transition proposal remains separate from transition commit.

```text
Implementation status: declared
Conformance evidence:  none yet
```

---

## Contributing

This is an experimental research project. Contributions should align with the project's anti-goals and core principles.

### Development Workflow

1. All changes must pass the Gate Tribunal audit (`/qor-audit` — the QoreLogic command family is `qor-*`)
2. Code must adhere to Section 4 Razor constraints:
   - Functions ≤ 40 lines
   - Files ≤ 250 lines
   - Nesting ≤ 3 levels
3. All changes are logged in the META_LEDGER

---

## License

Apache-2.0 — [See LICENSE file](LICENSE)

---

## Acknowledgments

- **Autopoietic Memory Theory** — Foundational theoretical framework
- **Prism UOR Foundation** — Model Development Kit for identity algebra
- **QoreLogic A.E.G.I.S.** — Governance protocol for accountable development

---

*Built with the QoreLogic A.E.G.I.S. lifecycle protocol*
