/**
 * Core memory type definitions
 * Section 4 Razor: Single source of truth for memory structures
 */

export type Phase =
  | 'IDLE'
  | 'GROUNDING'
  | 'SEMANTIC_PAUSE'
  | 'ACTIVE_FLOW'
  | 'DETACHMENT'
  | 'REM_SYNTHESIS';

export type Tier = 'L1' | 'L2' | 'L3';

export interface MemoryMetadata {
  t_0: number;           // Creation timestamp
  w_0: number;           // Initial salience (0-1)
  lambda: number;        // Decay constant
  mts_score: number;     // Memory Tier Score
  tier: Tier;            // Assigned tier
  source_phase: Phase;   // Creating lifecycle phase
  parent_uor?: string;   // Deprecation pointer
  session_id: string;    // Creating session
}

export interface MemoryUnit {
  uor_id: string;
  content: unknown;
  embedding: Float32Array;
  metadata: MemoryMetadata;
}

export interface RawInput {
  content: unknown;
  metadata?: Partial<Pick<MemoryMetadata, 'w_0' | 'lambda'>>;
  sourcePhase?: Phase;
}

export interface Query {
  content: string | StructuredQuery;
  context: QueryContext;
  constraints: QueryConstraints;
}

export interface StructuredQuery {
  type: 'exact' | 'semantic' | 'relational';
  payload: unknown;
}

export interface QueryContext {
  session_id: string;
  base_context?: BaseContext;
  fiber_budget?: FiberBudget;
}

export interface QueryConstraints {
  max_latency_ms?: number;
  min_relevance?: number;
  require_l3?: boolean;
  exclude_decayed?: boolean;
  top_k?: number;
}

export interface BaseContext {
  soul_file_uor?: string;
  session_start: number;
  constraints: Record<string, unknown>;
}

export interface FiberBudget {
  total: number;
  remaining: number;
  allocated: Map<string, number>;
}

export interface ScoredMemory {
  unit: MemoryUnit;
  relevance_score: number;
  decayed_weight: number;
  retrieval_path: string[];
}

export interface RecallResult {
  memories: ScoredMemory[];
  trace: RetrievalTrace;
  certificate?: PipelineCertificate;
  metrics: RecallMetrics;
}

export interface RecallMetrics {
  latency_ms: number;
  tiers_queried: Tier[];
  candidates_evaluated: number;
  decay_filtered: number;
}

export interface RetrievalTrace {
  query_id: string;
  timestamp: number;
  steps: TraceStep[];
}

export interface TraceStep {
  phase: string;
  timestamp: number;
  data: unknown;
}

export interface PipelineCertificate {
  certificate_id: string;
  issued_at: number;
  pipeline_hash: string;
  attestations: string[];
}
