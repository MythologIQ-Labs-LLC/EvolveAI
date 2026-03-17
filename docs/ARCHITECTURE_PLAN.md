# Architecture Plan

## Risk Grade: L3

### Risk Assessment

- [x] Contains security/auth logic -> L3 (cryptographic memory integrity)
- [x] Modifies existing APIs -> L2 (complete architectural rebuild)
- [ ] UI-only changes -> L1

**Rationale**: Novel agentic memory system with cryptographic hash chains, tiered memory with decay algorithms, and associative graph structures. High complexity, research-grade architecture.

## File Tree (The Contract)

```
src/
|-- core/
|   |-- memory/
|   |   |-- index.ts                 # Memory system entry point
|   |   |-- types.ts                 # Core type definitions
|   |   |-- encoder.ts               # Memory encoding (input -> memory unit)
|   |   |-- decoder.ts               # Memory retrieval (query -> recall)
|   |   `-- decay.ts                 # Half-life decay algorithms
|   |
|   |-- tiers/
|   |   |-- stm.ts                   # Short-term memory buffer
|   |   |-- ltm.ts                   # Long-term memory store
|   |   |-- promotion.ts             # STM -> LTM promotion logic
|   |   `-- router.ts                # Tiered memory router
|   |
|   |-- graph/
|   |   |-- node.ts                  # Memory node definition
|   |   |-- edge.ts                  # Semantic relationship edges
|   |   |-- traversal.ts             # Graph traversal algorithms
|   |   `-- consolidation.ts         # Graph compaction/pruning
|   |
|   `-- chain/
|       |-- hash.ts                  # Cryptographic hash utilities
|       |-- block.ts                 # Memory block structure
|       |-- ledger.ts                # Integrity ledger
|       `-- verify.ts                # Chain verification
|
|-- ui/
|   |-- components/
|   |   |-- memory-visualizer/       # Graph/network visualization
|   |   |-- tier-inspector/          # STM/LTM tier display
|   |   |-- chain-explorer/          # Hash chain audit view
|   |   `-- decay-monitor/           # Memory decay dashboard
|   |
|   |-- layouts/
|   |   `-- main-layout.tsx          # Primary app shell
|   |
|   `-- pages/
|       |-- dashboard.tsx            # Main memory dashboard
|       |-- explorer.tsx             # Memory exploration view
|       `-- settings.tsx             # Configuration
|
|-- lib/
|   |-- storage/
|   |   |-- local.ts                 # Local persistence layer
|   |   `-- index.ts                 # Storage abstraction
|   |
|   `-- utils/
|       |-- hash.ts                  # Hashing utilities
|       |-- time.ts                  # Temporal utilities
|       `-- id.ts                    # ID generation
|
`-- tests/
    |-- core/                        # Core memory tests
    |-- integration/                 # Integration tests
    `-- fixtures/                    # Test data
```

## Interface Contracts

### MemoryEncoder
- **Input**: `RawInput` (text, structured data, or sensory input)
- **Output**: `MemoryUnit` (encoded representation with metadata)
- **Side Effects**: None (pure transformation)

### MemoryDecoder
- **Input**: `Query` (retrieval request with context)
- **Output**: `RecallResult` (matched memories with confidence scores)
- **Side Effects**: Updates access timestamps, may trigger decay recalculation

### TierRouter
- **Input**: `MemoryUnit` + `TierContext`
- **Output**: `TierDecision` (STM, LTM, or promote/demote action)
- **Side Effects**: May trigger promotion/demotion workflows

### GraphNode
- **Input**: `MemoryUnit`
- **Output**: `Node` with edges to related memories
- **Side Effects**: Creates/updates edges in associative graph

### HashChain
- **Input**: `MemoryOperation` (create, update, decay, delete)
- **Output**: `Block` with cryptographic hash linking to previous
- **Side Effects**: Appends to immutable ledger

### DecayEngine
- **Input**: `MemoryUnit` + `CurrentTime`
- **Output**: `DecayedMemory` (strength-adjusted or marked for removal)
- **Side Effects**: May trigger consolidation or deletion

## Data Flow

```
[Raw Input]
    -> [Encoder]
    -> [TierRouter]
    -> [STM Buffer | LTM Store]
    -> [GraphNode Creation]
    -> [HashChain Logging]

[Query]
    -> [Decoder]
    -> [Graph Traversal]
    -> [Tier Lookup]
    -> [Decay Adjustment]
    -> [RecallResult]

[Time Tick]
    -> [DecayEngine]
    -> [Promotion Check]
    -> [Consolidation]
    -> [HashChain Logging]
```

## Dependencies

| Package | Justification | Vanilla Alternative |
|---------|---------------|---------------------|
| React 18 | UI rendering, retained from previous design | No - component model essential |
| Tailwind CSS | Styling system, retained | Yes, but design system already built |
| Radix UI | Accessible primitives, retained | Yes, but accessibility burden |
| Vitest | Testing framework | Jest (heavier) |
| D3.js or vis-network | Graph visualization | Canvas API (significant effort) |
| crypto (Node built-in) | Hash chain integrity | N/A - built-in |

**Note**: No external cloud dependencies. All memory operations local-first.

## Section 4 Razor Pre-Check

- [x] All planned functions <= 40 lines
- [x] All planned files <= 250 lines
- [x] No planned nesting > 3 levels

**Decomposition Strategy**: Each memory subsystem (tiers, graph, chain) is isolated. Complex operations are broken into composable pure functions.

---

*Blueprint sealed. Awaiting GATE tribunal.*
*Risk Grade L3: /ql-audit MANDATORY before implementation.*
