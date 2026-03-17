/**
 * Memory Decoder - Query execution and retrieval
 * Section 4 Razor: Single responsibility - decoding pipeline
 */

import { generateUorId } from '../../lib/utils/id';
import { now } from '../../lib/utils/time';
import { computeDecayedWeight, applyDecayFilter, DEFAULT_DECAY_CONFIG } from './decay';
import type {
  Query,
  RecallResult,
  MemoryUnit,
  ScoredMemory,
  RetrievalTrace,
  TraceStep,
  Tier
} from './types';

export interface DecoderConfig {
  topK: number;
  decayThreshold: number;
  parallelTierQuery: boolean;
  maxTraversalDepth: number;
}

export const DEFAULT_DECODER_CONFIG: DecoderConfig = {
  topK: 10,
  decayThreshold: DEFAULT_DECAY_CONFIG.floorThreshold,
  parallelTierQuery: true,
  maxTraversalDepth: 3
};

export type ResolverType = 'exact' | 'semantic' | 'relational';

export interface TierQueryResult {
  tier: Tier;
  units: MemoryUnit[];
  latency_ms: number;
}

/**
 * Dispatch: Select resolver type based on query
 */
export function dispatch(query: Query): ResolverType {
  if (typeof query.content === 'object' && 'type' in query.content) {
    return query.content.type;
  }
  return 'semantic';
}

/**
 * Create retrieval trace
 */
function createTrace(queryId: string): RetrievalTrace {
  return {
    query_id: queryId,
    timestamp: now(),
    steps: []
  };
}

function addTraceStep(trace: RetrievalTrace, phase: string, data: unknown): void {
  trace.steps.push({ phase, timestamp: now(), data });
}

/**
 * Score and filter retrieved units
 */
function scoreMemories(
  units: MemoryUnit[],
  queryEmbedding: Float32Array,
  currentTime: number,
  config: DecoderConfig
): ScoredMemory[] {
  return units
    .map(unit => {
      const decayed_weight = computeDecayedWeight(unit, currentTime);
      const relevance_score = cosineSimilarity(unit.embedding, queryEmbedding);
      return {
        unit,
        relevance_score,
        decayed_weight,
        retrieval_path: [unit.uor_id]
      };
    })
    .filter(m => m.decayed_weight >= config.decayThreshold)
    .sort((a, b) => b.relevance_score * b.decayed_weight - a.relevance_score * a.decayed_weight)
    .slice(0, config.topK);
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Decode query into RecallResult
 * Pipeline: Dispatch → Ground → Query Tiers → Resolve → Decay Filter → Project
 */
export async function decode(
  query: Query,
  queryEmbedding: Float32Array,
  tierQueryFn: (tier: Tier, embedding: Float32Array, k: number) => Promise<TierQueryResult>,
  config: DecoderConfig = DEFAULT_DECODER_CONFIG
): Promise<RecallResult> {
  const startTime = now();
  const queryId = generateUorId({ query: query.content, timestamp: startTime });
  const trace = createTrace(queryId);

  // Step 1: Dispatch
  const resolverType = dispatch(query);
  addTraceStep(trace, 'DISPATCH', { resolverType });

  // Step 2: Determine tiers to query
  const tiersToQuery: Tier[] = query.constraints.require_l3
    ? ['L3']
    : ['L1', 'L2', 'L3'];
  addTraceStep(trace, 'GROUND', { tiersToQuery });

  // Step 3: Query tiers
  const topK = query.constraints.top_k ?? config.topK;
  const tierResults = await Promise.all(
    tiersToQuery.map(tier => tierQueryFn(tier, queryEmbedding, topK))
  );
  addTraceStep(trace, 'TIER_QUERY', { results: tierResults.map(r => ({ tier: r.tier, count: r.units.length })) });

  // Step 4: Merge and deduplicate
  const allUnits = new Map<string, MemoryUnit>();
  for (const result of tierResults) {
    for (const unit of result.units) {
      if (!allUnits.has(unit.uor_id)) {
        allUnits.set(unit.uor_id, unit);
      }
    }
  }
  addTraceStep(trace, 'MERGE', { uniqueUnits: allUnits.size });

  // Step 5: Score and filter
  const currentTime = now();
  const scored = scoreMemories(
    Array.from(allUnits.values()),
    queryEmbedding,
    currentTime,
    config
  );
  addTraceStep(trace, 'SCORE_FILTER', { scored: scored.length });

  // Step 6: Build result
  const endTime = now();
  return {
    memories: scored,
    trace,
    metrics: {
      latency_ms: endTime - startTime,
      tiers_queried: tiersToQuery,
      candidates_evaluated: allUnits.size,
      decay_filtered: allUnits.size - scored.length
    }
  };
}
