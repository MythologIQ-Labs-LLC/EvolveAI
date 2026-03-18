# Plan: v2.0 Foundations - Bridging Theory to Implementation

## Open Questions

All resolved.

1. ~~**Embedding Provider**~~ **RESOLVED**: Design `RepresentationEngine` abstraction that is model-agnostic. Transformer implementation is first backend.

2. ~~**Persistence Backend**~~ **RESOLVED**: SQLite. Queryable storage enables future optimizations (range queries on timestamps, indexed lookups by tier, aggregations for stats). Pluggable interface remains—SQLite is the production default, MemoryAdapter for tests.

3. ~~**Decay Scheduler**~~ **RESOLVED**: Hybrid. Event-driven decay on access (lazy evaluation as designed) PLUS background tick for proactive pruning. Flexibility via config: can disable background tick for resource-constrained environments.

---

## Phase 1: Representation Engine

The current system has transformer-era assumptions baked in: fixed-dimension `Float32Array`, hardcoded cosine similarity, single embedding per memory. This phase introduces a model-agnostic abstraction that:

- Enables hot-swapping models without re-architecting
- Supports future non-transformer representations
- Centralizes similarity computation (enabling different strategies)
- Provides migration path between model generations

### Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                     REPRESENTATION ENGINE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Memory System (model-agnostic)                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  - Stores: Representation (opaque)                      │    │
│  │  - Compares via: engine.similarity(a, b)                │    │
│  │  - Never inspects internal structure                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  Engine Interface (stable contract)                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  encode(content) → Representation                       │    │
│  │  similarity(a, b, strategy?) → number                   │    │
│  │  serialize/deserialize                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  Implementations (swappable)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Transformer  │  │   Future:    │  │   Future:    │          │
│  │ (Float32,    │  │  Symbolic    │  │   Hybrid     │          │
│  │  cosine)     │  │  (graphs)    │  │  (multi-rep) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Affected Files

- `src/core/representation/types.ts` - NEW: Core abstraction types
- `src/core/representation/engine.ts` - NEW: Engine interface and factory
- `src/core/representation/transformer.ts` - NEW: Transformer implementation
- `src/core/representation/similarity.ts` - NEW: Similarity strategies
- `src/core/representation/index.ts` - NEW: Public exports
- `src/core/memory/types.ts` - Replace `embedding: Float32Array` with `representation: Representation`
- `src/core/memory/encoder.ts` - Use engine for encoding
- `src/core/memory/decoder.ts` - Use engine for similarity
- `src/core/tiers/l2-graph.ts` - Use engine for similarity
- `src/core/shadow/interceptor.ts` - Use engine for similarity
- `src/core/processor/index.ts` - Wire up engine
- `src/core/processor/config.ts` - Add engine config

### Changes

**src/core/representation/types.ts**
```typescript
/**
 * Opaque representation of content.
 * Memory system never inspects internals—only passes to engine.
 */
export interface Representation {
  /** Serialized form (opaque to consumers) */
  readonly bytes: Uint8Array;
  /** Model that produced this representation */
  readonly modelId: string;
  /** Schema version for migration */
  readonly version: number;
}

/**
 * Similarity computation strategies.
 * Engine implementations may support subset.
 */
export type SimilarityStrategy =
  | 'cosine'        // Default: angle between vectors
  | 'euclidean'     // Distance-based
  | 'dot_product'   // Fast when normalized
  | 'maxsim'        // ColBERT-style token-level max
  | 'hybrid';       // Dense + sparse fusion

/**
 * Result of cross-model comparison.
 */
export interface CrossModelResult {
  score: number;
  degraded: boolean;  // True if comparison is approximate
  reason?: string;    // Why degraded, if applicable
}

/**
 * Engine capabilities for feature detection.
 */
export interface EngineCapabilities {
  supportedStrategies: SimilarityStrategy[];
  supportsBatch: boolean;
  supportsQuantization: boolean;
  supportsCrossModel: boolean;
}
```

**src/core/representation/engine.ts**
```typescript
import type {
  Representation,
  SimilarityStrategy,
  CrossModelResult,
  EngineCapabilities
} from './types';

/**
 * Core abstraction for content representation.
 * Implementations handle encoding, comparison, serialization.
 */
export interface RepresentationEngine {
  /** Model identifier */
  readonly modelId: string;

  /** Engine capabilities */
  readonly capabilities: EngineCapabilities;

  /**
   * Encode content into representation.
   */
  encode(content: string): Promise<Representation>;

  /**
   * Batch encode for efficiency.
   */
  encodeBatch(contents: string[]): Promise<Representation[]>;

  /**
   * Compute similarity between representations.
   * @param strategy - Comparison method (default: cosine)
   */
  similarity(
    a: Representation,
    b: Representation,
    strategy?: SimilarityStrategy
  ): Promise<number>;

  /**
   * Compare representations from different models.
   * Returns degraded flag if comparison is approximate.
   */
  crossModelSimilarity(
    a: Representation,
    b: Representation
  ): Promise<CrossModelResult>;

  /**
   * Serialize for persistence.
   */
  serialize(rep: Representation): Uint8Array;

  /**
   * Deserialize from persistence.
   */
  deserialize(bytes: Uint8Array): Representation;

  /**
   * Check if representation is from this engine's model.
   */
  isNative(rep: Representation): boolean;
}

/**
 * Engine configuration.
 */
export interface EngineConfig {
  type: 'transformer' | 'external';
  modelId?: string;
  externalFn?: (content: string) => Promise<Representation>;
}

/**
 * Create engine from configuration.
 */
export function createEngine(config: EngineConfig): Promise<RepresentationEngine>;
```

**src/core/representation/transformer.ts**
```typescript
import type { RepresentationEngine, EngineCapabilities } from './engine';
import type { Representation, SimilarityStrategy, CrossModelResult } from './types';

/**
 * Transformer-based implementation.
 * Uses @xenova/transformers for local inference.
 */
export class TransformerEngine implements RepresentationEngine {
  readonly modelId: string;
  readonly capabilities: EngineCapabilities = {
    supportedStrategies: ['cosine', 'euclidean', 'dot_product'],
    supportsBatch: true,
    supportsQuantization: false,  // Future: int8 support
    supportsCrossModel: false     // Future: projection matrices
  };

  private dimensions: number;
  private pipeline: unknown;  // Xenova pipeline (lazy-loaded)

  private constructor(modelId: string, dimensions: number) {
    this.modelId = modelId;
    this.dimensions = dimensions;
  }

  /**
   * Create and initialize transformer engine.
   */
  static async create(modelId: string = 'Xenova/all-MiniLM-L6-v2'): Promise<TransformerEngine>;

  async encode(content: string): Promise<Representation> {
    // 1. Run through transformer pipeline
    // 2. Extract Float32Array
    // 3. Wrap in Representation with modelId, version
  }

  async encodeBatch(contents: string[]): Promise<Representation[]> {
    // Batch inference for efficiency
  }

  async similarity(
    a: Representation,
    b: Representation,
    strategy: SimilarityStrategy = 'cosine'
  ): Promise<number> {
    // 1. Deserialize to Float32Array
    // 2. Apply strategy-specific computation
  }

  async crossModelSimilarity(a: Representation, b: Representation): Promise<CrossModelResult> {
    // For now: if models differ, return degraded
    if (a.modelId !== b.modelId) {
      return { score: 0, degraded: true, reason: 'Cross-model comparison not yet supported' };
    }
    return { score: await this.similarity(a, b), degraded: false };
  }

  serialize(rep: Representation): Uint8Array {
    // Already in bytes form
    return rep.bytes;
  }

  deserialize(bytes: Uint8Array): Representation {
    // Parse header for modelId, version
    // Return Representation wrapper
  }

  isNative(rep: Representation): boolean {
    return rep.modelId === this.modelId;
  }
}

/**
 * Create transformer engine with default model.
 */
export function createTransformerEngine(modelId?: string): Promise<TransformerEngine>;
```

**src/core/representation/similarity.ts**
```typescript
/**
 * Pure similarity functions for Float32Array.
 * Used internally by TransformerEngine.
 */

export function cosineSimilarity(a: Float32Array, b: Float32Array): number;
export function euclideanDistance(a: Float32Array, b: Float32Array): number;
export function dotProduct(a: Float32Array, b: Float32Array): number;

/**
 * Normalize euclidean to 0-1 similarity score.
 */
export function euclideanToSimilarity(distance: number, maxDistance: number): number;
```

**src/core/memory/types.ts**
```typescript
// BEFORE
export interface MemoryUnit {
  uor_id: string;
  content: unknown;
  embedding: Float32Array;  // ← Transformer assumption
  metadata: MemoryMetadata;
}

// AFTER
import type { Representation } from '../representation/types';

export interface MemoryUnit {
  uor_id: string;
  content: unknown;
  representation: Representation;  // ← Model-agnostic
  metadata: MemoryMetadata;
}
```

**Migration pattern for all files using `cosineSimilarity`**:
```typescript
// BEFORE (in decoder.ts, l2-graph.ts, interceptor.ts)
import { cosineSimilarity } from './decoder';  // or local impl
const score = cosineSimilarity(a.embedding, b.embedding);

// AFTER
const score = await engine.similarity(a.representation, b.representation);
```

### Unit Tests

- `src/tests/core/representation.test.ts`
  - Engine creates valid Representation with correct modelId
  - Batch encoding returns array matching input length
  - Similar content has similarity > 0.8
  - Different content has similarity < 0.3
  - Serialize/deserialize roundtrip preserves representation
  - `isNative()` returns true for same-model representations
  - Cross-model comparison returns `degraded: true` for different models

- `src/tests/core/similarity.test.ts`
  - Cosine similarity of identical vectors = 1.0
  - Cosine similarity of orthogonal vectors = 0.0
  - Euclidean distance of identical vectors = 0.0
  - Dot product matches manual calculation

---

## Phase 2: Persistence Layer

Current state: All tiers are in-memory Maps. A crash loses everything.

Design: Pluggable storage adapters following the Repository pattern. SQLite for production (queryable), MemoryAdapter for tests.

### Why SQLite over LevelDB

| Capability | SQLite | LevelDB |
|------------|--------|---------|
| Range queries (e.g., "nodes created after X") | Native | Manual iteration |
| Indexed lookups by tier | Native | Key prefix scan |
| Aggregations (count, sum decay weights) | Native | Manual |
| Complex queries for future analytics | Native | Not supported |
| Single file deployment | ✓ | Directory |
| ACID transactions | Full | Limited |

### Affected Files

- `src/core/storage/types.ts` - NEW: Storage adapter interface
- `src/core/storage/memory.ts` - NEW: In-memory adapter (tests)
- `src/core/storage/sqlite.ts` - NEW: SQLite adapter (production)
- `src/core/storage/index.ts` - NEW: Factory and exports
- `src/core/tiers/l1-cache.ts` - Accept storage adapter
- `src/core/tiers/l2-graph.ts` - Accept storage adapter
- `src/core/tiers/l3-vault.ts` - Accept storage adapter
- `src/core/chain/ledger.ts` - Accept storage adapter

### Changes

**src/core/storage/types.ts**
```typescript
export interface StorageAdapter<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(): AsyncIterable<string>;
  values(): AsyncIterable<T>;
  entries(): AsyncIterable<[string, T]>;
  clear(): Promise<void>;
  close(): Promise<void>;

  /** Batch operations for efficiency */
  getBatch(keys: string[]): Promise<Map<string, T>>;
  setBatch(entries: Array<[string, T]>): Promise<void>;
}

export interface StorageConfig {
  type: 'memory' | 'sqlite';
  path?: string;      // For SQLite: database file path
  tableName?: string; // For SQLite: table name (enables multi-collection in one DB)
}
```

**src/core/storage/memory.ts**
```typescript
export class MemoryAdapter<T> implements StorageAdapter<T> {
  private data = new Map<string, T>();
  // Synchronous operations wrapped as Promises for interface consistency
}
```

**src/core/storage/sqlite.ts**
```typescript
export class SQLiteAdapter<T> implements StorageAdapter<T> {
  // Uses 'better-sqlite3' for sync API (faster than async for local DB)
  // Schema: CREATE TABLE {tableName} (key TEXT PRIMARY KEY, value TEXT, created_at INTEGER, updated_at INTEGER)
  // Values serialized via JSON + custom Representation handling (Uint8Array → base64)
  // Indexes on created_at, updated_at for range queries
}
```

**Tier modifications pattern** (apply to L1, L2, L3, Ledger):
```typescript
// Before
private nodes: Map<string, GraphNode> = new Map();

// After
private storage: StorageAdapter<GraphNode>;

constructor(storage: StorageAdapter<GraphNode>, config: L2GraphConfig) {
  this.storage = storage;
}

// Methods become async where they touch storage
async getNode(uorId: string): Promise<GraphNode | null> {
  return this.storage.get(uorId);
}
```

### Unit Tests

- `src/tests/core/storage.test.ts`
  - Memory adapter: CRUD operations work
  - SQLite adapter: Data persists across close/reopen
  - SQLite adapter: Range queries by timestamp work
  - Keys iteration returns all stored keys
  - Batch operations work correctly
  - Clear removes all data
  - Table isolation works (two adapters with different tables don't conflict)

---

## Phase 3: Semantic MTS Assessment

Current state: MTS routing uses tag-based heuristics (`tags.includes('sensitive')`). No actual semantic analysis.

Design: Use representation similarity against reference patterns for each assessment dimension.

### Affected Files

- `src/core/tiers/assessment.ts` - NEW: Semantic assessment functions
- `src/core/tiers/reference-patterns.ts` - NEW: Reference pattern definitions
- `src/core/tiers/router.ts` - Replace heuristic functions with semantic assessment
- `src/core/tiers/types.ts` - Add assessment config

### Changes

**src/core/tiers/assessment.ts**
```typescript
import type { RepresentationEngine } from '../representation/engine';
import type { Representation } from '../representation/types';

export interface AssessmentContext {
  engine: RepresentationEngine;
  referencePatterns: ReferencePatterns;
}

export interface ReferencePatterns {
  sensitivity: {
    high: Representation[];  // Pre-encoded sensitive patterns
    low: Representation[];   // Pre-encoded non-sensitive patterns
  };
  accuracy: {
    high: Representation[];
    low: Representation[];
  };
  privilege: {
    high: Representation[];
    low: Representation[];
  };
}

/**
 * Assess sensitivity via similarity to reference patterns.
 * Returns score 0-1 based on max similarity to high vs low patterns.
 */
export async function assessSensitivity(
  rep: Representation,
  context: AssessmentContext
): Promise<number>;

export async function assessAccuracyRequirement(
  rep: Representation,
  context: AssessmentContext
): Promise<number>;

export async function assessPrivilegeLevel(
  rep: Representation,
  context: AssessmentContext
): Promise<number>;
```

**src/core/tiers/reference-patterns.ts**
```typescript
// Raw text patterns - encoded at runtime via engine
export const SENSITIVITY_PATTERNS = {
  high: [
    'password', 'secret key', 'SSN', 'credit card number',
    'private key', 'API token', 'authentication credential'
  ],
  low: [
    'weather today', 'hello world', 'meeting notes',
    'grocery list', 'general information'
  ]
};

export const ACCURACY_PATTERNS = {
  high: [
    'the definition of', 'the formula is', 'according to the specification',
    'the exact value', 'must be precisely'
  ],
  low: [
    'I think', 'maybe', 'probably', 'it seems like',
    'roughly', 'approximately', 'in my opinion'
  ]
};

export const PRIVILEGE_PATTERNS = {
  high: [
    'system configuration', 'admin access', 'root privilege',
    'database connection', 'encryption key'
  ],
  low: [
    'user preference', 'display setting', 'theme color',
    'notification option', 'language choice'
  ]
};

/**
 * Encode all reference patterns using engine.
 * Called once at startup, cached.
 */
export async function encodeReferencePatterns(
  engine: RepresentationEngine
): Promise<ReferencePatterns>;
```

**src/core/tiers/router.ts**
- `routeMemoryUnit` becomes async
- Takes `AssessmentContext` parameter
- Calls semantic assessment functions
- Falls back to tag heuristics if no engine available (backwards compat during migration)

### Unit Tests

- `src/tests/core/assessment.test.ts`
  - "my password is X" scores high sensitivity (> 0.7)
  - "the weather is nice" scores low sensitivity (< 0.3)
  - "the formula for X is Y" scores high accuracy requirement
  - "I think maybe" scores low accuracy requirement
  - Assessment is deterministic for same input

---

## Phase 4: Shadow Genome Bootstrap

Current state: Shadow Genome ships empty. Semantic Pause passes everything.

Design: Pre-populate with canonical failure patterns using RepresentationEngine.

### Affected Files

- `src/core/shadow/bootstrap.ts` - NEW: Default failure patterns
- `src/core/shadow/genome.ts` - Add bootstrap method
- `src/core/shadow/interceptor.ts` - Use engine for similarity checks
- `src/core/processor/index.ts` - Call bootstrap on init

### Changes

**src/core/shadow/bootstrap.ts**
```typescript
import type { RepresentationEngine } from '../representation/engine';
import type { FailureCategory } from './failure-types';
import type { ShadowGenome } from './genome';

export interface BootstrapPattern {
  category: FailureCategory;
  intent: string;
  message: string;
}

export const BOOTSTRAP_PATTERNS: BootstrapPattern[] = [
  {
    category: 'COMPLEXITY_VIOLATION',
    intent: 'Add abstraction layer for single use case',
    message: 'Premature abstraction adds complexity without benefit'
  },
  {
    category: 'COMPLEXITY_VIOLATION',
    intent: 'Create factory for class instantiated once',
    message: 'Over-engineering simple construction'
  },
  {
    category: 'PREMATURE_OPTIMIZATION',
    intent: 'Optimize code path without profiling data',
    message: 'Optimization without measurement is speculation'
  },
  {
    category: 'PREMATURE_OPTIMIZATION',
    intent: 'Add caching before identifying bottleneck',
    message: 'Premature caching adds complexity and potential bugs'
  },
  {
    category: 'HALLUCINATION',
    intent: 'Claim capability without verification',
    message: 'Unverified claims lead to runtime failures'
  },
  {
    category: 'HALLUCINATION',
    intent: 'Assert API exists without checking documentation',
    message: 'Assumed APIs may not exist or behave differently'
  },
  {
    category: 'SCOPE_CREEP',
    intent: 'Add unrequested feature during implementation',
    message: 'Scope creep derails project timelines'
  },
  {
    category: 'SCOPE_CREEP',
    intent: 'Refactor surrounding code while fixing bug',
    message: 'Unrelated changes increase risk and review burden'
  },
  {
    category: 'SECURITY_REGRESSION',
    intent: 'Disable security check for convenience',
    message: 'Security shortcuts create vulnerabilities'
  },
  {
    category: 'SECURITY_REGRESSION',
    intent: 'Log sensitive data for debugging',
    message: 'Debug logging can expose credentials'
  },
  {
    category: 'TECHNICAL_DEBT',
    intent: 'Skip tests to meet deadline',
    message: 'Missing tests compound future maintenance cost'
  },
  {
    category: 'TECHNICAL_DEBT',
    intent: 'Copy-paste code instead of extracting function',
    message: 'Duplication multiplies future bug fixes'
  },
  // ... additional patterns
];

/**
 * Bootstrap genome with canonical failure patterns.
 * Returns count of patterns added.
 */
export async function bootstrapGenome(
  genome: ShadowGenome,
  engine: RepresentationEngine
): Promise<number>;
```

**src/core/shadow/interceptor.ts**
```typescript
// Update to use RepresentationEngine instead of raw cosine similarity

export interface ShadowInterceptorConfig {
  engine: RepresentationEngine;  // NEW
  safetyThreshold: number;
  criticalCategories: FailureCategory[];
}

// check() method now uses engine.similarity()
```

### Unit Tests

- `src/tests/core/shadow-bootstrap.test.ts`
  - Bootstrap adds all canonical patterns
  - Bootstrapped genome blocks "add unnecessary abstraction" intent
  - Bootstrapped genome blocks "skip tests for deadline" intent
  - Bootstrapped genome passes "implement requested feature" intent
  - Double-bootstrap is idempotent (no duplicates)

---

## Phase 5: Hybrid Decay Scheduler

Current state: Decay computed lazily on retrieval. Dead memories never pruned.

Design: **Hybrid approach** combining:
1. **Event-driven** (existing): Decay computed on access (lazy evaluation)
2. **Time-driven** (new): Background tick for proactive pruning

This provides flexibility—resource-constrained environments can disable background tick while still getting lazy decay on access.

### Affected Files

- `src/core/scheduler/types.ts` - NEW: Scheduler interface
- `src/core/scheduler/decay-scheduler.ts` - NEW: Hybrid decay runner
- `src/core/scheduler/index.ts` - NEW: Exports
- `src/core/tiers/l2-graph.ts` - Add `pruneDecayed()` method
- `src/core/memory/decay.ts` - Add event hooks for access-triggered decay
- `src/core/processor/index.ts` - Start/stop scheduler with processor

### Changes

**src/core/scheduler/types.ts**
```typescript
export interface SchedulerConfig {
  /** Enable background tick (can be disabled for resource-constrained environments) */
  backgroundTickEnabled: boolean;
  /** Tick interval when background is enabled */
  tickIntervalMs: number;
  /** Min nodes before consolidation runs */
  consolidationThreshold: number;
  /** Decay weight below which to prune */
  pruneThreshold: number;
  /** Enable event-driven decay on access (always recommended) */
  accessDecayEnabled: boolean;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  backgroundTickEnabled: true,
  tickIntervalMs: 60000,  // 1 minute
  consolidationThreshold: 100,
  pruneThreshold: 0.01,
  accessDecayEnabled: true
};

export interface SchedulerStats {
  lastTickAt: number;
  totalTicks: number;
  nodesPruned: number;
  nodesConsolidated: number;
  accessDecayEvents: number;  // Count of event-driven decays
}

export type DecayEvent = {
  type: 'ACCESS' | 'TICK';
  nodeId: string;
  oldWeight: number;
  newWeight: number;
  pruned: boolean;
};

export type DecayEventListener = (event: DecayEvent) => void;
```

**src/core/scheduler/decay-scheduler.ts**
```typescript
export class DecayScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private stats: SchedulerStats;
  private listeners: DecayEventListener[] = [];

  constructor(
    private l2Graph: L2GraphStore,
    private config: SchedulerConfig
  );

  /** Start background tick (if enabled) */
  start(): void;

  /** Stop background tick */
  stop(): void;

  /** Manual tick for testing */
  tick(): Promise<SchedulerStats>;

  /**
   * Called on node access - event-driven decay.
   * Integrated into L2GraphStore.access() method.
   */
  onAccess(nodeId: string): Promise<DecayEvent>;

  /** Subscribe to decay events */
  on(listener: DecayEventListener): () => void;

  private async runDecayPass(): Promise<void> {
    // 1. Query L2 nodes via SQLite (can use timestamp indexes for efficiency)
    // 2. Compute decayed weight for each
    // 3. Prune if below threshold
    // 4. Emit events
    // 5. Run consolidation if above node count threshold
  }
}
```

**src/core/tiers/l2-graph.ts**
```typescript
async pruneDecayed(threshold: number, currentTime: number): Promise<string[]> {
  const pruned: string[] = [];
  for await (const node of this.storage.values()) {
    const weight = computeDecayedWeight(node, currentTime);
    if (weight < threshold) {
      await this.removeNode(node.uorId);
      pruned.push(node.uorId);
    }
  }
  return pruned;
}
```

### Unit Tests

- `src/tests/core/scheduler.test.ts`
  - **Background tick mode**:
    - Scheduler ticks at configured interval
    - Decayed nodes are pruned after tick
    - Stable nodes survive pruning
    - Stop prevents further ticks
  - **Event-driven mode**:
    - onAccess() computes decay and emits event
    - Pruned flag is true when weight < threshold
  - **Hybrid mode**:
    - Both modes work together
    - Stats track both tick and access events
  - **Disabled modes**:
    - backgroundTickEnabled=false skips timer
    - accessDecayEnabled=false skips access decay
  - Manual tick() works for testing without timers

---

## Summary

| Phase | Focus | Key Deliverable | Transformer Benefit | Post-Transformer Benefit |
|-------|-------|-----------------|---------------------|--------------------------|
| 1 | Representation | Model-agnostic abstraction | Hot-swap models, similarity strategies | Future representation types |
| 2 | Persistence | SQLite storage | Queryable, ACID, single file | N/A (orthogonal) |
| 3 | MTS Assessment | Intelligent tier routing | Semantic analysis | Uses engine abstraction |
| 4 | Shadow Bootstrap | Safety checks have teeth | Real blocking | Uses engine abstraction |
| 5 | Decay Scheduler | Hybrid event+tick decay | Flexible resource usage | N/A (orthogonal) |

### Dependency Graph

```
Phase 1 (Representation) ──┬──▶ Phase 3 (MTS Assessment)
                           ├──▶ Phase 4 (Shadow Bootstrap)
                           └──▶ Phase 5 (Scheduler uses engine for nothing, but benefits from Phase 2)

Phase 2 (Persistence) ──▶ Independent, can parallel with Phase 1
```

### Implementation Order

1. **Phase 1 + Phase 2** in parallel (no dependencies)
2. **Phase 3 + Phase 4 + Phase 5** in parallel after Phase 1 completes
3. Integration testing after all phases

---

_Plan follows Simple Made Easy principles: each phase adds one composable capability. Phase 1's abstraction provides immediate transformer benefits while preparing for post-transformer architectures._
