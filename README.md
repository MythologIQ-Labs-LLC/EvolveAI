# EvolveAI: Autopoietic Memory System

An exploration into theoretical agentic memory architecture—a learning computer that evolves its own neural network-like memory structures rather than serving as a static assistant.

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

## Architecture

### Neural Net Processor

The **Neural Net Processor** serves as the computational engine implementing the Autopoietic Memory Theory. It orchestrates:

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

Each cognitive cycle progresses through five distinct phases:

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

### Memory Tier Score (MTS) Routing

Memories are routed to tiers using the MTS algorithm:

```
MTS = (S × Ws) + (A × Wa) + (P × Wp) - (C × Wc)
```

Where:
- **S** = Sensitivity (personal data, secrets)
- **A** = Accuracy requirement (facts, references)
- **P** = Privilege level (core knowledge, foundational)
- **C** = Compute constraint (current resource availability)

Routing thresholds:
- MTS > 0.8 → L3 (UOR Vault)
- MTS > 0.3 → L2 (Temporal Graph)
- MTS ≤ 0.3 → L1 (Transient Cache)

### CMHL: Cryptographic Memory Half-Life

Decay is computed lazily on retrieval using exponential decay:

```
w_current = w₀ × e^(-λt)
```

Where:
- `w₀` = initial weight (salience at encoding)
- `λ` = decay constant (tier-specific)
- `t` = time since last access

### Shadow Genome

A negative-constraint immune system that blocks execution when intent matches known failure patterns:

- Tracks failure categories: `COMPLEXITY_VIOLATION`, `HALLUCINATION`, `SECURITY_REGRESSION`, etc.
- Uses cosine similarity against embedded failure traces
- Provides safety verdicts: `PASS` or `BLOCK`

---

## Project Structure

```
src/
├── core/
│   ├── processor/          # Main NeuralNetProcessor facade
│   │   ├── index.ts        # Processor class and factory
│   │   ├── types.ts        # Public type definitions
│   │   └── config.ts       # Unified configuration
│   │
│   ├── memory/             # Memory encoding/decoding
│   │   ├── types.ts        # MemoryUnit, Query, RecallResult
│   │   ├── encoder.ts      # Input → MemoryUnit encoding
│   │   ├── decoder.ts      # Query → RecallResult decoding
│   │   └── decay.ts        # CMHL decay engine
│   │
│   ├── tiers/              # Tiered memory storage
│   │   ├── router.ts       # MTS calculation and routing
│   │   ├── l1-cache.ts     # Transient vector cache
│   │   ├── l2-graph.ts     # Temporal graph with decay
│   │   └── l3-vault.ts     # UOR vault interface
│   │
│   ├── graph/              # Graph data structures
│   │   ├── node.ts         # GraphNode definition
│   │   ├── edge.ts         # Decay-weighted edges
│   │   ├── traversal.ts    # BFS/DFS with CMHL
│   │   └── consolidation.ts # Graph pruning
│   │
│   ├── chain/              # L3 hash chain
│   │   ├── hash.ts         # SHA256/UOR hashing
│   │   ├── block.ts        # Block structure
│   │   ├── ledger.ts       # Chain management
│   │   └── verify.ts       # Integrity verification
│   │
│   ├── shadow/             # Safety system
│   │   ├── genome.ts       # Shadow Genome store
│   │   ├── interceptor.ts  # Semantic pause interceptor
│   │   └── failure-types.ts # Failure taxonomy
│   │
│   └── lifecycle/          # 5-Phase orchestration
│       ├── orchestrator.ts # State machine
│       ├── trace.ts        # Pipeline tracing
│       └── phases/         # Phase implementations
│           ├── grounding.ts
│           ├── semantic-pause.ts
│           ├── active-flow.ts
│           ├── detachment.ts
│           └── rem-synthesis.ts
│
├── lib/
│   └── utils/              # Utility functions
│       ├── hash.ts         # Cryptographic hashing
│       ├── time.ts         # Temporal utilities
│       └── id.ts           # UOR ID generation
│
└── tests/                  # Test suite
    ├── core/               # Unit tests
    ├── integration/        # Integration tests
    └── fixtures/           # Test data
```

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/evolve-ai.git
cd evolve-ai

# Install dependencies
npm install

# Run tests
npm test
```

## Usage

### Basic Usage

```typescript
import { createProcessor } from './src/core/processor';

// Create processor with default configuration
const processor = createProcessor();

// Initialize the memory system
const initResult = await processor.initialize({
  identity: 'my-agent'
});

console.log(`Session: ${initResult.sessionId}`);
console.log(`Genesis Hash: ${initResult.genesisHash}`);

// Encode a memory
const encodeResult = await processor.encode({
  content: 'Important fact to remember',
  metadata: { tags: ['fact', 'reference'] }
});

console.log(`Stored in: ${encodeResult.tierDecision.tier}`);

// Query memories
const queryResult = await processor.query({
  content: 'What facts do I know?',
  embedding: myEmbeddingFunction('What facts do I know?'),
  context: { intent: 'recall' }
});

console.log(`Found ${queryResult.recall.memories.length} memories`);

// Shutdown
processor.shutdown();
```

### Custom Configuration

```typescript
import { createProcessor, createProcessorConfig } from './src/core/processor';

const config = createProcessorConfig({
  lifecycle: {
    synthesisThreshold: 20,
    detachmentStrategy: 'batched'
  },
  tierThresholds: {
    l3: 0.9,  // More selective for L3
    l2: 0.4
  },
  interceptor: {
    safetyThreshold: 0.9,  // Stricter safety
    criticalCategories: ['SECURITY_REGRESSION', 'HALLUCINATION']
  }
});

const processor = createProcessor(config);
```

### Event Handling

```typescript
const processor = createProcessor();

// Subscribe to events
const unsubscribe = processor.on((event) => {
  switch (event.type) {
    case 'MEMORY_ENCODED':
      console.log(`Encoded ${event.unitId} to ${event.tier}`);
      break;
    case 'SAFETY_BLOCK':
      console.warn(`Blocked: ${event.reason}`);
      break;
    case 'SYNTHESIS_COMPLETE':
      console.log(`Crystallized ${event.result.crystallized} memories`);
      break;
  }
});

// Later: unsubscribe
unsubscribe();
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/tests/core/decay.test.ts

# Watch mode
npm run test:watch
```

### Test Coverage

| Module | Status | Coverage |
|--------|--------|----------|
| `core/memory/decay` | ✅ Implemented | Unit tests |
| `core/chain/*` | ✅ Implemented | Unit tests |
| `core/tiers/router` | ✅ Implemented | Unit tests |
| `core/lifecycle/*` | ✅ Implemented | Unit tests |
| `core/graph/*` | ⚠️ Partial | Needs integration tests |
| `core/shadow/*` | ⚠️ Partial | Needs integration tests |
| `core/processor` | ⚠️ Partial | Needs end-to-end tests |

### Test Gaps (TODO)

1. **Encoder/Decoder Integration** — Test full encode→store→query→decode flow
2. **Graph Traversal Edge Cases** — Test cycles, disconnected components, large graphs
3. **Shadow Genome Effectiveness** — Test blocking accuracy, false positive rates
4. **L3 Vault Persistence** — Test export/import, recovery from corruption
5. **Lifecycle Edge Transitions** — Test error recovery, timeout handling
6. **Memory Pressure** — Test behavior under L1 eviction pressure
7. **Concurrent Operations** — Test parallel encode/query operations
8. **Embedding Model Integration** — Test with actual embedding models (MiniLM)

---

## Documentation

| Document | Description |
|----------|-------------|
| [CONCEPT.md](docs/CONCEPT.md) | Project DNA — Why, Vibe, Anti-Goals |
| [ARCHITECTURE_PLAN.md](docs/ARCHITECTURE_PLAN.md) | Original architecture blueprint |
| [NEURAL_NET_PROCESSOR_DESIGN.md](docs/NEURAL_NET_PROCESSOR_DESIGN.md) | Detailed design specification |
| [AUTOPOIETIC_MEMORY_THEORY.md](docs/AUTOPOIETIC_MEMORY_THEORY.md) | Theoretical foundations |
| [META_LEDGER.md](docs/META_LEDGER.md) | QoreLogic governance chain |

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

1. All changes must pass the Gate Tribunal audit (`/ql-audit`)
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
