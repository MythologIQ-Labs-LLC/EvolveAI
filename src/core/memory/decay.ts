/**
 * Cryptographic Memory Half-Life (CMHL) Decay Engine
 * Section 4 Razor: Pure functions for decay computation
 */

import { now } from '../../lib/utils/time';
import type { MemoryUnit, Tier } from './types';

export interface DecayConfig {
  defaultLambda: Record<Tier, number>;
  floorThreshold: number;
  crystallizationThreshold: number;
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  defaultLambda: {
    L1: 0.1,      // Aggressive decay (hours)
    L2: 0.001,    // Moderate decay (days/weeks)
    L3: 0.0       // No decay (immutable)
  },
  floorThreshold: 0.01,
  crystallizationThreshold: 10000
};

/**
 * Core decay function: w = w₀ × e^(-λΔt)
 * Lazy evaluation - only compute on retrieval
 */
export function computeDecay(
  w0: number,
  lambda: number,
  t0: number,
  tCurrent: number
): number {
  if (lambda === 0) return w0;
  const deltaT = tCurrent - t0;
  return w0 * Math.exp(-lambda * deltaT);
}

export function computeDecayedWeight(
  unit: MemoryUnit,
  currentTime: number = now()
): number {
  const { w_0, lambda, t_0 } = unit.metadata;
  return computeDecay(w_0, lambda, t_0, currentTime);
}

export function applyDecayFilter(
  units: MemoryUnit[],
  threshold: number,
  currentTime: number = now()
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

export function isStable(
  unit: MemoryUnit,
  cycles: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): boolean {
  const decayedWeight = computeDecayedWeight(unit);
  return (
    cycles >= config.crystallizationThreshold &&
    decayedWeight >= config.floorThreshold
  );
}

export function getLambdaForTier(
  tier: Tier,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): number {
  return config.defaultLambda[tier];
}

/**
 * Check if a memory is still "alive" (weight above threshold)
 */
export function isMemoryAlive(
  w0: number,
  lambda: number,
  t0: number,
  tCurrent: number,
  threshold: number = DEFAULT_DECAY_CONFIG.floorThreshold
): boolean {
  const currentWeight = computeDecay(w0, lambda, t0, tCurrent);
  return currentWeight >= threshold;
}

/**
 * Check if a memory should be crystallized to L3
 * Based on access frequency and age
 */
export function shouldCrystallize(
  accessCount: number,
  _ageMs: number,
  threshold: number = DEFAULT_DECAY_CONFIG.crystallizationThreshold
): boolean {
  // Simple threshold check - memory accessed frequently enough
  return accessCount >= threshold;
}
