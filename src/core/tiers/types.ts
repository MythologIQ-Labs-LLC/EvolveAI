/**
 * Tier System Type Definitions
 * MoE routing and tier-specific storage interfaces
 */

import type { Tier, MemoryUnit } from '../memory/types';

/**
 * MTS (Memory Tier Score) weights
 */
export interface MTSWeights {
  /** Sensitivity weight (W_s) */
  sensitivity: number;
  /** Accuracy weight (W_a) */
  accuracy: number;
  /** Privilege weight (W_p) */
  privilege: number;
  /** Compute constraint weight (W_c) */
  compute: number;
}

/**
 * Routing decision from tier router
 */
export interface TierDecision {
  /** Target tier */
  tier: Tier;
  /** Calculated MTS score */
  mtsScore: number;
  /** Confidence in routing decision */
  confidence: number;
  /** Human-readable reasoning */
  reasoning: string;
}

/**
 * Tier threshold configuration
 */
export interface TierThresholds {
  /** MTS threshold for L3 (above this → UOR Vault) */
  l3: number;
  /** MTS threshold for L2 (above this → Temporal Graph) */
  l2: number;
  /** Below L2 threshold → Transient Cache */
}

/**
 * Memory unit assessment factors
 */
export interface AssessmentFactors {
  /** Sensitivity score (0-1) */
  sensitivity: number;
  /** Accuracy requirement (0-1) */
  accuracy: number;
  /** Privilege level (0-1) */
  privilege: number;
  /** Current compute constraint (0-1) */
  computeConstraint: number;
}

/**
 * Query result from a tier
 */
export interface TierQueryResult {
  /** Matched memory units */
  units: MemoryUnit[];
  /** Source tier */
  tier: Tier;
  /** Query execution time in ms */
  queryTimeMs: number;
}

/**
 * Default MTS weights
 */
export const DEFAULT_MTS_WEIGHTS: MTSWeights = {
  sensitivity: 0.3,
  accuracy: 0.3,
  privilege: 0.2,
  compute: 0.2
};

/**
 * Default tier thresholds
 */
export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  l3: 0.8,
  l2: 0.3
};
