/**
 * Tier Router (MoE Architecture)
 * Routes memory units to appropriate tiers based on MTS score
 */

import type { Tier, MemoryUnit } from '../memory/types';
import type {
  MTSWeights,
  TierDecision,
  TierThresholds,
  AssessmentFactors
} from './types';
import {
  DEFAULT_MTS_WEIGHTS,
  DEFAULT_TIER_THRESHOLDS
} from './types';

// Re-export constants for external use
export { DEFAULT_MTS_WEIGHTS, DEFAULT_TIER_THRESHOLDS };

/**
 * Calculate MTS (Memory Tier Score)
 * MTS = (S × W_s) + (A × W_a) + (P × W_p) - (C × W_c)
 */
export function calculateMTS(
  factors: AssessmentFactors,
  weights: MTSWeights = DEFAULT_MTS_WEIGHTS
): number {
  const score =
    factors.sensitivity * weights.sensitivity +
    factors.accuracy * weights.accuracy +
    factors.privilege * weights.privilege -
    factors.computeConstraint * weights.compute;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

/**
 * Determine tier from MTS score
 */
export function determineTierFromMTS(
  mtsScore: number,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS
): Tier {
  if (mtsScore > thresholds.l3) return 'L3';
  if (mtsScore > thresholds.l2) return 'L2';
  return 'L1';
}

/**
 * Assess sensitivity of a memory unit
 * Higher for personal data, secrets, etc.
 */
export function assessSensitivity(unit: MemoryUnit): number {
  const metadata = unit.metadata;

  // Check for explicit sensitivity markers
  if (metadata.tags?.includes('sensitive')) return 0.9;
  if (metadata.tags?.includes('personal')) return 0.7;
  if (metadata.tags?.includes('secret')) return 1.0;

  // Default moderate sensitivity
  return 0.3;
}

/**
 * Assess accuracy requirement of a memory unit
 * Higher for facts, references, definitions
 */
export function assessAccuracyRequirement(unit: MemoryUnit): number {
  const metadata = unit.metadata;

  // Check for content type markers
  if (metadata.tags?.includes('fact')) return 0.9;
  if (metadata.tags?.includes('reference')) return 0.8;
  if (metadata.tags?.includes('definition')) return 0.85;
  if (metadata.tags?.includes('ephemeral')) return 0.2;

  return 0.5;
}

/**
 * Assess privilege level of a memory unit
 * Higher for important, foundational memories
 */
export function assessPrivilegeLevel(unit: MemoryUnit): number {
  const metadata = unit.metadata;

  // Check for privilege markers
  if (metadata.tags?.includes('core')) return 0.9;
  if (metadata.tags?.includes('foundational')) return 0.85;
  if (metadata.tags?.includes('temporary')) return 0.1;

  return 0.4;
}

/**
 * Get current compute constraint (0 = unconstrained, 1 = fully constrained)
 */
export function getCurrentComputeConstraint(): number {
  // In a real implementation, this would check:
  // - Available memory
  // - CPU usage
  // - Active queries
  // For now, return a default moderate constraint
  return 0.3;
}

/**
 * Generate reasoning string for routing decision
 */
function generateReasoning(
  tier: Tier,
  mts: number,
  factors: AssessmentFactors
): string {
  const tierName =
    tier === 'L3' ? 'UOR Vault' :
    tier === 'L2' ? 'Temporal Graph' :
    'Transient Cache';

  return `Routed to ${tierName} (MTS=${mts.toFixed(3)}) based on ` +
    `S=${factors.sensitivity.toFixed(2)}, ` +
    `A=${factors.accuracy.toFixed(2)}, ` +
    `P=${factors.privilege.toFixed(2)}, ` +
    `C=${factors.computeConstraint.toFixed(2)}`;
}

/**
 * Route a memory unit to the appropriate tier
 */
export function routeMemoryUnit(
  unit: MemoryUnit,
  weights: MTSWeights = DEFAULT_MTS_WEIGHTS,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS
): TierDecision {
  const factors: AssessmentFactors = {
    sensitivity: assessSensitivity(unit),
    accuracy: assessAccuracyRequirement(unit),
    privilege: assessPrivilegeLevel(unit),
    computeConstraint: getCurrentComputeConstraint()
  };

  const mtsScore = calculateMTS(factors, weights);
  const tier = determineTierFromMTS(mtsScore, thresholds);

  // Calculate confidence based on distance from thresholds
  let confidence: number;
  if (tier === 'L3') {
    confidence = (mtsScore - thresholds.l3) / (1 - thresholds.l3);
  } else if (tier === 'L2') {
    const midpoint = (thresholds.l3 + thresholds.l2) / 2;
    confidence = 1 - Math.abs(mtsScore - midpoint) / (thresholds.l3 - thresholds.l2);
  } else {
    confidence = (thresholds.l2 - mtsScore) / thresholds.l2;
  }

  return {
    tier,
    mtsScore,
    confidence: Math.max(0, Math.min(1, confidence)),
    reasoning: generateReasoning(tier, mtsScore, factors)
  };
}

/**
 * Batch route multiple memory units
 */
export function routeBatch(
  units: MemoryUnit[],
  weights?: MTSWeights,
  thresholds?: TierThresholds
): Map<string, TierDecision> {
  const results = new Map<string, TierDecision>();

  for (const unit of units) {
    results.set(unit.uor_id, routeMemoryUnit(unit, weights, thresholds));
  }

  return results;
}
