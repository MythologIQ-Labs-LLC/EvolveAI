/**
 * Phase 4: Detachment
 * Clean up transient state and prepare for synthesis
 */

import type { PipelineTrace, LifecycleConfig } from '../types';
import type { L1Cache } from '../../tiers/l1-cache';
import type { L2GraphStore } from '../../tiers/l2-graph';

/**
 * Detachment result
 */
export interface DetachmentResult {
  /** Number of L1 entries evicted */
  l1Evicted: number;
  /** Whether L2 checkpoint was created */
  l2Checkpointed: boolean;
  /** Number of traces ready for synthesis */
  tracesForSynthesis: number;
  /** Whether synthesis should trigger */
  shouldSynthesize: boolean;
}

/**
 * Detachment context
 */
export interface DetachmentContext {
  /** L1 cache to clear */
  l1Cache?: L1Cache;
  /** L2 graph to checkpoint */
  l2Graph?: L2GraphStore;
  /** Collected traces */
  traces: PipelineTrace[];
  /** Lifecycle configuration */
  config: LifecycleConfig;
}

/**
 * Execute detachment phase
 */
export function executeDetachment(
  context: DetachmentContext
): DetachmentResult {
  let l1Evicted = 0;
  let l2Checkpointed = false;

  // Evict L1 cache based on strategy
  if (context.l1Cache) {
    if (context.config.detachmentStrategy === 'immediate') {
      l1Evicted = context.l1Cache.size();
      context.l1Cache.clear();
    } else {
      // Batched: only evict expired
      l1Evicted = context.l1Cache.evictExpired();
    }
  }

  // Checkpoint L2 graph
  if (context.l2Graph) {
    context.l2Graph.checkpoint();
    l2Checkpointed = true;
  }

  // Determine if synthesis should trigger
  const tracesForSynthesis = context.traces.length;
  const shouldSynthesize = tracesForSynthesis >= context.config.synthesisThreshold;

  return {
    l1Evicted,
    l2Checkpointed,
    tracesForSynthesis,
    shouldSynthesize
  };
}

/**
 * Quick detachment for immediate strategy
 */
export function executeImmediateDetachment(
  l1Cache?: L1Cache
): { evicted: number } {
  if (!l1Cache) return { evicted: 0 };

  const evicted = l1Cache.size();
  l1Cache.clear();

  return { evicted };
}

/**
 * Batched detachment with selective eviction
 */
export function executeBatchedDetachment(
  l1Cache?: L1Cache,
  evictionThreshold: number = 0.5
): { evicted: number } {
  if (!l1Cache) return { evicted: 0 };

  // Only evict if cache is over threshold
  const size = l1Cache.size();
  if (size > 0) {
    const evicted = l1Cache.evictExpired();
    return { evicted };
  }

  return { evicted: 0 };
}

/**
 * Reset attention state (placeholder for future implementation)
 */
export function resetAttentionState(): void {
  // In a full implementation, this would clear:
  // - Active attention windows
  // - Working memory buffers
  // - Temporary computation state
}

/**
 * Create detachment summary for logging
 */
export function formatDetachmentResult(result: DetachmentResult): string {
  const parts = [
    `L1 evicted: ${result.l1Evicted}`,
    `L2 checkpoint: ${result.l2Checkpointed}`,
    `Traces: ${result.tracesForSynthesis}`
  ];

  if (result.shouldSynthesize) {
    parts.push('→ REM_SYNTHESIS');
  } else {
    parts.push('→ IDLE');
  }

  return parts.join(' | ');
}
