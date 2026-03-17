# Neural Net Processor Design Plan

## QoreLogic Phase: PLAN
## Risk Grade: L3 (Cryptographic memory integrity + novel architecture)

---

## 1. Executive Summary

The **Neural Net Processor** is the computational engine that implements the Autopoietic Memory Theory. It orchestrates the 5-Phase Metabolic Lifecycle, manages the Tri-Layer Memory System, and provides the primitives for encoding, retrieval, decay, and crystallization.

**Core Responsibility**: Transform raw inputs into verified memories, retrieve contextually relevant memories with decay-adjusted weights, and evolve the memory substrate through recursive learning.

---

## 2. Architectural Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEURAL NET PROCESSOR                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LIFECYCLE ORCHESTRATOR                            │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │   │
│  │  │GROUND  │→│ PAUSE  │→│ FLOW   │→│DETACH  │→│  REM   │            │   │
│  │  │Phase 1 │ │Phase 2 │ │Phase 3 │ │Phase 4 │ │Phase 5 │            │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼───────────────────────────────────┐   │
│  │                    PROCESSING CORE                                   │   │
│  │                                 │                                    │   │
│  │  ┌──────────────┐    ┌─────────┴─────────┐    ┌──────────────┐     │   │
│  │  │   ENCODER    │    │   INFERENCE (ι)   │    │   DECODER    │     │   │
│  │  │              │    │   P ∘ Π ∘ G       │    │              │     │   │
│  │  │ • embed()    │    │                   │    │ • recall()   │     │   │
│  │  │ • hash()     │    │ • ground()        │    │ • project()  │     │   │
│  │  │ • classify() │    │ • resolve()       │    │ • format()   │     │   │
│  │  └──────────────┘    │ • accumulate()    │    └──────────────┘     │   │
│  │                      │ • project()       │                          │   │
│  │                      └───────────────────┘                          │   │
│  │                                                                      │   │
│  │  ┌──────────────┐    ┌───────────────────┐    ┌──────────────┐     │   │
│  │  │ TIER ROUTER  │    │  DECAY ENGINE     │    │SHADOW GENOME │     │   │
│  │  │   (MoE)      │    │    (CMHL)         │    │  INTERCEPTOR │     │   │
│  │  │              │    │                   │    │              │     │   │
│  │  │ • MTS calc   │    │ • lazy eval       │    │ • vectorize  │     │   │
│  │  │ • dispatch   │    │ • w×e^(-λt)       │    │ • similarity │     │   │
│  │  │ • route      │    │ • threshold       │    │ • block/pass │     │   │
│  │  └──────────────┘    └───────────────────┘    └──────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ══════════════════════════════════╪════════════════════════════════════   │
│                           MEMORY BUS                                        │
│  ══════════════════════════════════╪════════════════════════════════════   │
│              ┌─────────────────────┼─────────────────────┐                 │
│              │                     │                     │                 │
│              ▼                     ▼                     ▼                 │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐        │
│  │   L1 TRANSIENT    │ │   L2 TEMPORAL     │ │   L3 UOR VAULT    │        │
│  │      CACHE        │ │      GRAPH        │ │                   │        │
│  │                   │ │                   │ │                   │        │
│  │ • VectorStore     │ │ • GraphStore      │ │ • HashChain       │        │
│  │ • TTL eviction    │ │ • CMHL decay      │ │ • Immutable       │        │
│  │ • Fuzzy retrieval │ │ • Edge traversal  │ │ • O(1) lookup     │        │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Lifecycle Orchestrator

**Location**: `src/core/lifecycle/`

**Responsibility**: Manage the 5-Phase Metabolic Lifecycle state machine.

```typescript
// src/core/lifecycle/types.ts
type Phase = 'IDLE' | 'GROUNDING' | 'SEMANTIC_PAUSE' | 'ACTIVE_FLOW' | 'DETACHMENT' | 'REM_SYNTHESIS';

interface LifecycleState {
  currentPhase: Phase;
  sessionId: string;
  baseContext: BaseContext | null;
  fiberBudget: FiberBudget | null;
  traces: PipelineTrace[];
  phaseTimestamps: Record<Phase, number>;
}

interface LifecycleConfig {
  synthesisThreshold: number;      // Traces before REM synthesis triggers
  detachmentStrategy: 'immediate' | 'batched';
  groundingTimeout: number;
}
```

**Files**:
- `orchestrator.ts` - Main state machine and phase transitions
- `phases/grounding.ts` - Phase 1 implementation
- `phases/semantic-pause.ts` - Phase 2 implementation
- `phases/active-flow.ts` - Phase 3 implementation
- `phases/detachment.ts` - Phase 4 implementation
- `phases/rem-synthesis.ts` - Phase 5 implementation

### 3.2 Encoder Module

**Location**: `src/core/memory/encoder.ts`

**Responsibility**: Transform raw inputs into MemoryUnits with embeddings, UOR hashes, and tier classifications.

```typescript
// src/core/memory/encoder.ts
interface EncoderConfig {
  embeddingModel: 'minilm' | 'sentence-bert' | 'custom';
  embeddingDimension: number;
  hashAlgorithm: 'sha256' | 'blake3';
  mtsWeights: MTSWeights;
}

interface MTSWeights {
  sensitivity: number;    // W_s
  accuracy: number;       // W_a
  privilege: number;      // W_p
  compute: number;        // W_c
}

interface MemoryEncoder {
  encode(input: RawInput): Promise<MemoryUnit>;
  embed(content: any): Promise<Float32Array>;
  hash(content: any): string;
  calculateMTS(unit: MemoryUnit, context: EncodingContext): number;
}
```

**Encoding Pipeline**:
```
RawInput → Normalize → Embed → Hash → Calculate MTS → Create MemoryUnit
```

### 3.3 Decoder Module

**Location**: `src/core/memory/decoder.ts`

**Responsibility**: Execute queries against memory tiers and return decay-adjusted results.

```typescript
// src/core/memory/decoder.ts
interface DecoderConfig {
  topK: number;
  decayThreshold: number;         // Minimum w_current to include
  parallelTierQuery: boolean;
  maxTraversalDepth: number;
}

interface MemoryDecoder {
  decode(query: Query): Promise<RecallResult>;
  dispatch(query: Query): ResolverType;
  ground(query: Query): GroundedQuery;
  resolve(grounded: GroundedQuery, context: Context): Promise<ResolvedBindings>;
  project(bindings: ResolvedBindings): SurfaceResult;
}
```

**Retrieval Pipeline**:
```
Query → Dispatch(δ) → Ground(G) → Resolve(Π) → Decay Filter → Project(P) → RecallResult
```

### 3.4 Tier Router (MoE Architecture)

**Location**: `src/core/tiers/router.ts`

**Responsibility**: Route MemoryUnits to appropriate tiers based on MTS score.

```typescript
// src/core/tiers/router.ts
interface TierDecision {
  tier: 'L1' | 'L2' | 'L3';
  mtsScore: number;
  confidence: number;
  reasoning: string;
}

interface TierRouter {
  route(unit: MemoryUnit): TierDecision;

  // Expert networks for each tier
  readonly l1Expert: L1CacheExpert;
  readonly l2Expert: L2GraphExpert;
  readonly l3Expert: L3VaultExpert;
}

// MTS Calculation
function calculateMTS(unit: MemoryUnit, weights: MTSWeights): number {
  const S = assessSensitivity(unit);
  const A = assessAccuracyRequirement(unit);
  const P = assessPrivilegeLevel(unit);
  const C = getCurrentComputeConstraint();

  return (S * weights.sensitivity) +
         (A * weights.accuracy) +
         (P * weights.privilege) -
         (C * weights.compute);
}

// Routing thresholds
const TIER_THRESHOLDS = {
  L3: 0.8,   // MTS > 0.8 → UOR Vault
  L2: 0.3,   // 0.3 < MTS ≤ 0.8 → Temporal Graph
  L1: 0.0    // MTS ≤ 0.3 → Transient Cache
};
```

### 3.5 Decay Engine (CMHL)

**Location**: `src/core/memory/decay.ts`

**Responsibility**: Compute time-based decay for memory weights using lazy evaluation.

```typescript
// src/core/memory/decay.ts
interface DecayConfig {
  defaultLambda: Record<'L1' | 'L2' | 'L3', number>;
  floorThreshold: number;         // Below this, memory is "forgotten"
  crystallizationThreshold: number; // Cycles without decay for L3 promotion
}

interface DecayEngine {
  // Lazy evaluation - only compute on retrieval
  computeDecay(unit: MemoryUnit, currentTime: number): number;

  // Batch decay for retrieved results
  applyDecayFilter(units: MemoryUnit[], threshold: number): MemoryUnit[];

  // Check crystallization eligibility
  isStable(unit: MemoryUnit, cycles: number): boolean;
}

// Core decay function
function computeDecay(w0: number, lambda: number, t0: number, tCurrent: number): number {
  const deltaT = tCurrent - t0;
  return w0 * Math.exp(-lambda * deltaT);
}

// Default decay constants by tier
const DEFAULT_LAMBDAS = {
  L1: 0.1,      // Aggressive decay (hours)
  L2: 0.001,    // Moderate decay (days/weeks)
  L3: 0.0       // No decay (immutable)
};
```

### 3.6 Shadow Genome Interceptor

**Location**: `src/core/shadow/interceptor.ts`

**Responsibility**: Block execution if intent matches known failure patterns.

```typescript
// src/core/shadow/interceptor.ts
interface ShadowGenomeConfig {
  safetyThreshold: number;        // Cosine similarity threshold for blocking
  maxMatchesToReturn: number;
  blockOnFirstMatch: boolean;
}

interface SafetyVerdict {
  verdict: 'PASS' | 'BLOCK';
  matchedConstraints: ShadowEntry[];
  highestSimilarity: number;
  reasoning: string;
}

interface ShadowGenomeInterceptor {
  check(intent: IntentPayload): Promise<SafetyVerdict>;
  ingest(failureTrace: FailureTrace): Promise<void>;
  getConstraints(): Promise<ShadowEntry[]>;
}

// Shadow entry structure
interface ShadowEntry {
  id: string;
  embedding: Float32Array;
  failureType: FailureCategory;
  originalTrace: FailureTrace;
  createdAt: number;
  triggerCount: number;
}

type FailureCategory =
  | 'COMPLEXITY_VIOLATION'
  | 'PREMATURE_OPTIMIZATION'
  | 'HALLUCINATION'
  | 'SECURITY_REGRESSION'
  | 'SCOPE_CREEP'
  | 'TECHNICAL_DEBT';
```

### 3.7 Hash Chain (L3 Vault)

**Location**: `src/core/chain/`

**Responsibility**: Immutable storage with cryptographic verification.

```typescript
// src/core/chain/types.ts
interface Block {
  index: number;
  timestamp: number;
  uorId: string;
  contentHash: string;
  previousHash: string;
  operation: MemoryOperation;
  metadata: BlockMetadata;
}

interface HashChain {
  append(content: any, operation: MemoryOperation): Promise<Block>;
  verify(uorId: string, content: any): boolean;
  retrieve(uorId: string): Promise<ImmutableMemory | null>;
  getChainHead(): Block;
  validateIntegrity(): Promise<IntegrityReport>;
}

type MemoryOperation = 'CRYSTALLIZE' | 'DEPRECATE' | 'GENESIS';
```

---

## 4. Data Flow Specifications

### 4.1 Encoding Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      ENCODING PIPELINE                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: RawInput { content, metadata, sourcePhase }             │
│                                                                  │
│  Step 1: NORMALIZE                                               │
│  ────────────────                                                │
│  • Sanitize content                                              │
│  • Extract structured data                                       │
│  • Validate schema                                               │
│                                                                  │
│  Step 2: EMBED                                                   │
│  ───────────                                                     │
│  • Generate semantic vector (384/768 dimensions)                │
│  • Use sentence-transformer model                                │
│  • Output: Float32Array                                          │
│                                                                  │
│  Step 3: HASH                                                    │
│  ─────────                                                       │
│  • Normalize content to canonical form                           │
│  • SHA256(normalized_content)                                    │
│  • Map to ring address: Z/(2^256)Z                              │
│  • Output: uor_id (64 hex chars)                                │
│                                                                  │
│  Step 4: CLASSIFY                                                │
│  ──────────────                                                  │
│  • Assess sensitivity (0-1)                                      │
│  • Assess accuracy requirement (0-1)                             │
│  • Assess privilege level (0-1)                                  │
│  • Get current compute constraint (0-1)                          │
│  • Calculate MTS = (S×Ws) + (A×Wa) + (P×Wp) - (C×Wc)           │
│  • Determine tier: L3 if >0.8, L2 if >0.3, else L1             │
│                                                                  │
│  Step 5: ASSIGN DECAY                                            │
│  ───────────────────                                             │
│  • L1: λ = 0.1 (aggressive)                                     │
│  • L2: λ = 0.001 (moderate)                                     │
│  • L3: λ = 0 (immortal)                                         │
│  • Set w_0 based on initial salience                            │
│  • Record t_0 = now()                                           │
│                                                                  │
│  Step 6: ROUTE                                                   │
│  ───────────                                                     │
│  • L1 → VectorStore.insert(embedding)                           │
│  • L2 → GraphStore.createNode(unit) + createEdges()             │
│  • L3 → HashChain.append(unit, 'CRYSTALLIZE')                   │
│                                                                  │
│  Output: MemoryUnit { content, embedding, uor_id, metadata }    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Retrieval Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      RETRIEVAL PIPELINE                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: Query { content, context, constraints }                 │
│                                                                  │
│  Step 1: DISPATCH (δ)                                           │
│  ────────────────────                                            │
│  • Analyze query type                                            │
│  • Select resolver from registry                                 │
│  • Route: exact_match → L3, semantic → L1+L2, relational → L2  │
│                                                                  │
│  Step 2: GROUND (G)                                             │
│  ──────────────────                                              │
│  • Embed query content                                           │
│  • Align with session BaseContext                                │
│  • Apply FiberBudget constraints                                 │
│  • Output: GroundedQuery with internal representation           │
│                                                                  │
│  Step 3: PARALLEL TIER QUERY                                    │
│  ───────────────────────────                                     │
│  • L1: VectorStore.topK(query_embedding, k)                     │
│  • L2: GraphStore.traverse(query_embedding, depth)              │
│  • L3: HashChain.lookup(extracted_uor_ids)                      │
│  • Merge results by uor_id                                       │
│                                                                  │
│  Step 4: RESOLVE (Π)                                            │
│  ───────────────────                                             │
│  • Apply resolver logic to merged candidates                     │
│  • Create bindings: Query × Candidate → Binding                 │
│  • Accumulate bindings into context (α)                         │
│                                                                  │
│  Step 5: DECAY FILTER (CMHL - Lazy)                             │
│  ──────────────────────────────────                              │
│  • For each retrieved unit:                                      │
│    w_current = w_0 × e^(-λ(t_now - t_0))                        │
│  • Filter: keep only w_current > threshold                      │
│  • Sort by decayed weight                                        │
│                                                                  │
│  Step 6: PROJECT (P)                                            │
│  ───────────────────                                             │
│  • Transform internal bindings to surface symbols               │
│  • Format for output consumption                                 │
│  • Attach retrieval trace and certificate                       │
│                                                                  │
│  Output: RecallResult { memories, trace, certificate }          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Phase Transition Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   LIFECYCLE STATE MACHINE                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [IDLE]                                                          │
│    │                                                             │
│    │ onSessionStart(config)                                      │
│    ▼                                                             │
│  [GROUNDING] ─────────────────────────────────────────────────── │
│    │ Actions:                                                    │
│    │   • soulFile = vault.retrieve(SOUL_FILE_UOR)               │
│    │   • baseContext = createBaseContext(soulFile, config)      │
│    │   • fiberBudget = initFiberBudget(config.constraints)      │
│    │                                                             │
│    │ Transition: groundingComplete                               │
│    ▼                                                             │
│  [SEMANTIC_PAUSE] ────────────────────────────────────────────── │
│    │ Actions:                                                    │
│    │   • intentVector = encoder.embed(intent)                   │
│    │   • verdict = shadowGenome.check(intentVector)             │
│    │                                                             │
│    │ Transitions:                                                │
│    │   • verdict.BLOCK → [IDLE] + return BlockedResult          │
│    │   • verdict.PASS  → [ACTIVE_FLOW]                          │
│    ▼                                                             │
│  [ACTIVE_FLOW] ───────────────────────────────────────────────── │
│    │ Actions:                                                    │
│    │   • trace = new PipelineTrace()                            │
│    │   • resolver = dispatch(query)                              │
│    │   • grounded = ground(query)                                │
│    │   • resolved = resolver.resolve(grounded, context)         │
│    │   • accumulated = accumulate(resolved, context)            │
│    │   • result = project(accumulated)                           │
│    │   • traces.push(trace)                                      │
│    │                                                             │
│    │ Transition: flowComplete                                    │
│    ▼                                                             │
│  [DETACHMENT] ────────────────────────────────────────────────── │
│    │ Actions:                                                    │
│    │   • l1Cache.evictAll()                                     │
│    │   • attentionState.reset()                                  │
│    │   • l2Graph.checkpoint()                                    │
│    │                                                             │
│    │ Transitions:                                                │
│    │   • traces.length >= synthesisThreshold → [REM_SYNTHESIS]  │
│    │   • otherwise → [IDLE]                                      │
│    ▼                                                             │
│  [REM_SYNTHESIS] ─────────────────────────────────────────────── │
│    │ Actions:                                                    │
│    │   • successTraces = traces.filter(SUCCESS)                 │
│    │   • failureTraces = traces.filter(FAILURE)                 │
│    │   • rules = extractRules(success, failure)                 │
│    │   • candidates = l2Graph.findStableNodes()                 │
│    │   • for each stable candidate:                              │
│    │       vault.crystallize(candidate)                          │
│    │   • traces.clear()                                          │
│    │                                                             │
│    │ Transition: synthesisComplete → [IDLE]                      │
│    ▼                                                             │
│  [IDLE] (ready for next cycle)                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. File Tree (Implementation Contract)

```
src/
├── core/
│   ├── processor/
│   │   ├── index.ts                 # NeuralNetProcessor main class
│   │   ├── types.ts                 # Core type definitions
│   │   └── config.ts                # Processor configuration
│   │
│   ├── memory/
│   │   ├── index.ts                 # Memory system entry point
│   │   ├── types.ts                 # MemoryUnit, Query, RecallResult
│   │   ├── encoder.ts               # Input → MemoryUnit encoding
│   │   ├── decoder.ts               # Query → RecallResult decoding
│   │   └── decay.ts                 # CMHL decay engine
│   │
│   ├── tiers/
│   │   ├── router.ts                # MTS calculation and tier routing
│   │   ├── l1-cache.ts              # Transient vector cache
│   │   ├── l2-graph.ts              # Temporal graph with decay
│   │   └── l3-vault.ts              # UOR vault interface
│   │
│   ├── graph/
│   │   ├── node.ts                  # GraphNode definition
│   │   ├── edge.ts                  # Edge with decay weight
│   │   ├── traversal.ts             # BFS/DFS with CMHL
│   │   └── consolidation.ts         # Graph pruning
│   │
│   ├── chain/
│   │   ├── hash.ts                  # SHA256/UOR hashing
│   │   ├── block.ts                 # Block structure
│   │   ├── ledger.ts                # Chain management
│   │   └── verify.ts                # Integrity verification
│   │
│   ├── shadow/
│   │   ├── genome.ts                # Shadow Genome store
│   │   ├── interceptor.ts           # Semantic Pause interceptor
│   │   └── failure-types.ts         # Failure taxonomy
│   │
│   └── lifecycle/
│       ├── orchestrator.ts          # State machine
│       ├── phases/
│       │   ├── grounding.ts         # Phase 1
│       │   ├── semantic-pause.ts    # Phase 2
│       │   ├── active-flow.ts       # Phase 3
│       │   ├── detachment.ts        # Phase 4
│       │   └── rem-synthesis.ts     # Phase 5
│       └── trace.ts                 # PipelineTrace recording
│
├── lib/
│   ├── embedding/
│   │   ├── index.ts                 # Embedding abstraction
│   │   └── minilm.ts                # MiniLM implementation
│   │
│   ├── storage/
│   │   ├── vector-store.ts          # L1 vector storage
│   │   ├── graph-store.ts           # L2 graph storage
│   │   └── local.ts                 # LocalStorage adapter
│   │
│   └── utils/
│       ├── hash.ts                  # Hashing utilities
│       ├── time.ts                  # Temporal utilities
│       └── id.ts                    # UOR ID generation
│
└── tests/
    ├── core/
    │   ├── encoder.test.ts
    │   ├── decoder.test.ts
    │   ├── decay.test.ts
    │   ├── router.test.ts
    │   └── lifecycle.test.ts
    │
    ├── integration/
    │   ├── encoding-flow.test.ts
    │   ├── retrieval-flow.test.ts
    │   └── lifecycle-flow.test.ts
    │
    └── fixtures/
        ├── memory-units.ts
        ├── queries.ts
        └── traces.ts
```

---

## 6. Interface Contracts

### 6.1 NeuralNetProcessor (Main Interface)

```typescript
interface NeuralNetProcessor {
  // Configuration
  readonly config: ProcessorConfig;

  // Lifecycle
  startSession(config: SessionConfig): Promise<SessionId>;
  endSession(sessionId: SessionId): Promise<SessionReport>;
  getCurrentPhase(): Phase;

  // Core Operations
  encode(input: RawInput): Promise<MemoryUnit>;
  decode(query: Query): Promise<RecallResult>;

  // Tier Management
  route(unit: MemoryUnit): TierDecision;
  promote(unitId: UorId): Promise<void>;  // L2 → L3

  // Shadow Genome
  checkSafety(intent: IntentPayload): Promise<SafetyVerdict>;
  ingestFailure(trace: FailureTrace): Promise<void>;

  // Observables
  getMetrics(): ProcessorMetrics;
  getTrace(sessionId: SessionId): PipelineTrace[];
}
```

### 6.2 MemoryUnit (Core Data Structure)

```typescript
interface MemoryUnit {
  // Identity
  uor_id: string;                    // Content-addressed hash

  // Content
  content: any;                      // Original payload
  embedding: Float32Array;           // Semantic vector

  // Temporal
  metadata: {
    t_0: number;                     // Creation timestamp
    w_0: number;                     // Initial salience (0-1)
    lambda: number;                  // Decay constant

    // Classification
    mts_score: number;               // Memory Tier Score
    tier: 'L1' | 'L2' | 'L3';       // Assigned tier
    source_phase: Phase;             // Creating lifecycle phase

    // Lineage
    parent_uor?: string;             // Deprecation pointer
    session_id: string;              // Creating session
  };
}
```

### 6.3 Query & RecallResult

```typescript
interface Query {
  content: string | StructuredQuery;
  context: {
    session_id: string;
    base_context: BaseContext;
    fiber_budget: FiberBudget;
  };
  constraints: {
    max_latency_ms?: number;
    min_relevance?: number;
    require_l3?: boolean;
    exclude_decayed?: boolean;
  };
}

interface RecallResult {
  memories: Array<{
    unit: MemoryUnit;
    relevance_score: number;
    decayed_weight: number;
    retrieval_path: UorId[];
  }>;
  trace: RetrievalTrace;
  certificate?: PipelineCertificate;
  metrics: {
    latency_ms: number;
    tiers_queried: ('L1' | 'L2' | 'L3')[];
    candidates_evaluated: number;
    decay_filtered: number;
  };
}
```

---

## 7. Algorithm Specifications

### 7.1 MTS Routing Algorithm

```typescript
function routeToTier(unit: MemoryUnit, weights: MTSWeights): TierDecision {
  // Assess input characteristics
  const S = assessSensitivity(unit);       // 0-1: security/privacy risk
  const A = assessAccuracyReq(unit);       // 0-1: hallucination tolerance
  const P = assessPrivilegeLevel(unit);    // 0-1: access clearance needed
  const C = getComputeConstraint();        // 0-1: current latency budget

  // Calculate Memory Tier Score
  const MTS = (S * weights.sensitivity) +
              (A * weights.accuracy) +
              (P * weights.privilege) -
              (C * weights.compute);

  // Route based on thresholds
  let tier: 'L1' | 'L2' | 'L3';
  let confidence: number;

  if (MTS > 0.8) {
    tier = 'L3';
    confidence = Math.min((MTS - 0.8) / 0.2, 1);
  } else if (MTS > 0.3) {
    tier = 'L2';
    confidence = Math.min((MTS - 0.3) / 0.5, 1);
  } else {
    tier = 'L1';
    confidence = Math.min((0.3 - MTS) / 0.3, 1);
  }

  return { tier, mtsScore: MTS, confidence, reasoning: `MTS=${MTS.toFixed(3)}` };
}
```

### 7.2 CMHL Decay Algorithm

```typescript
function computeDecayedWeight(
  unit: MemoryUnit,
  currentTime: number
): number {
  const { w_0, lambda, t_0 } = unit.metadata;

  // Core decay function: w = w₀ × e^(-λΔt)
  const deltaT = currentTime - t_0;
  const w_current = w_0 * Math.exp(-lambda * deltaT);

  return w_current;
}

function applyDecayFilter(
  units: MemoryUnit[],
  threshold: number,
  currentTime: number
): MemoryUnit[] {
  return units
    .map(unit => ({
      unit,
      decayedWeight: computeDecayedWeight(unit, currentTime)
    }))
    .filter(({ decayedWeight }) => decayedWeight >= threshold)
    .sort((a, b) => b.decayedWeight - a.decayedWeight)
    .map(({ unit }) => unit);
}
```

### 7.3 Shadow Genome Check Algorithm

```typescript
async function checkShadowGenome(
  intent: IntentPayload,
  shadowStore: ShadowGenome,
  config: ShadowGenomeConfig
): Promise<SafetyVerdict> {
  // Vectorize intent
  const intentVector = await embed(intent);

  // Search shadow genome for similar failure patterns
  const matches = await shadowStore.search(
    intentVector,
    config.maxMatchesToReturn
  );

  // Check against threshold
  const violations = matches.filter(
    match => match.similarity > config.safetyThreshold
  );

  if (violations.length > 0) {
    return {
      verdict: 'BLOCK',
      matchedConstraints: violations.map(v => v.entry),
      highestSimilarity: violations[0].similarity,
      reasoning: `Intent similar to known failure: ${violations[0].entry.failureType}`
    };
  }

  return {
    verdict: 'PASS',
    matchedConstraints: [],
    highestSimilarity: matches[0]?.similarity ?? 0,
    reasoning: 'No safety violations detected'
  };
}
```

### 7.4 Epistemic Crystallization Algorithm

```typescript
async function crystallize(
  node: GraphNode,
  vault: HashChain,
  config: CrystallizationConfig
): Promise<UorEntry> {
  // Validate crystallization eligibility
  if (!isEligible(node, config)) {
    throw new Error('Node not eligible for crystallization');
  }

  // Strip decay constant (make immortal)
  const crystallizedUnit: MemoryUnit = {
    ...node.unit,
    metadata: {
      ...node.unit.metadata,
      lambda: 0,  // No decay
      tier: 'L3'
    }
  };

  // Generate UOR hash
  const uorId = generateUorId(crystallizedUnit.content);

  // Append to hash chain
  const block = await vault.append(crystallizedUnit, 'CRYSTALLIZE');

  // Create deprecation pointer in L2
  await node.deprecate(uorId);

  return {
    uorId,
    block,
    unit: crystallizedUnit
  };
}

function isEligible(node: GraphNode, config: CrystallizationConfig): boolean {
  return (
    node.cycleCount >= config.minCycles &&
    node.utilityFrequency >= config.minUtilityFrequency &&
    node.contradictionCount === 0 &&
    node.decayedWeight >= config.decayFloor
  );
}
```

---

## 8. Dependencies

| Package | Purpose | Justification |
|---------|---------|---------------|
| **@xenova/transformers** | Embedding generation | Local inference, no cloud dependency |
| **lancedb** | L1 vector storage | Local-first, TypeScript, fast |
| **level** | L2/L3 key-value storage | Embedded, reliable |
| **crypto** (Node built-in) | UOR hashing | No external dependency |

**Total new dependencies**: 3 packages

---

## 9. Risk Assessment

### L3 Justification

| Risk Factor | Assessment |
|-------------|------------|
| **Cryptographic Operations** | UOR hashing for memory identity + hash chain integrity |
| **Novel Architecture** | First implementation of Autopoietic Memory Theory |
| **Data Integrity** | Immutable L3 vault with chain verification |
| **Complex State Machine** | 5-phase lifecycle with multiple transition paths |

### Mitigations

1. **Hash Chain Verification**: Every L3 operation verified against chain
2. **Phased Implementation**: Build and test each tier independently
3. **Shadow Genome**: Built-in failure tracking from day one
4. **Observable Everything**: Full trace recording for debugging

---

## 10. Implementation Phases

### Phase 1: Core Primitives (Foundation)
- [ ] Implement embedding module (MiniLM)
- [ ] Implement UOR hashing
- [ ] Implement decay function
- [ ] Create MemoryUnit type and validation

### Phase 2: Tier Infrastructure
- [ ] Implement L1 vector cache
- [ ] Implement L2 graph store with edges
- [ ] Implement L3 hash chain
- [ ] Implement tier router (MTS)

### Phase 3: Encoding/Decoding Pipelines
- [ ] Build encoder pipeline
- [ ] Build decoder pipeline with parallel tier query
- [ ] Implement decay filter

### Phase 4: Lifecycle Orchestrator
- [ ] Implement state machine
- [ ] Build Phase 1-4 handlers
- [ ] Build Phase 5 (REM synthesis) handler

### Phase 5: Shadow Genome
- [ ] Implement shadow store
- [ ] Build interceptor
- [ ] Create failure ingestion pipeline

### Phase 6: Integration & Testing
- [ ] End-to-end encoding flow tests
- [ ] End-to-end retrieval flow tests
- [ ] Lifecycle integration tests
- [ ] Performance benchmarks

---

## Section 4 Razor Pre-Check

- [x] All planned functions <= 40 lines
- [x] All planned files <= 250 lines
- [x] No planned nesting > 3 levels

---

*Blueprint sealed. Risk Grade L3. /ql-audit MANDATORY before implementation.*
