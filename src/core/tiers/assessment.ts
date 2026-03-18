/**
 * Semantic MTS Assessment
 * Content-aware assessment using representation similarity
 */

import type { RepresentationEngine } from '../representation/engine';
import type { Representation } from '../representation/types';
import type { ReferencePatterns } from './reference-patterns';

/**
 * Assessment context with engine and patterns
 */
export interface AssessmentContext {
  engine: RepresentationEngine;
  referencePatterns: ReferencePatterns;
}

/**
 * Compute max similarity to a set of patterns
 */
function maxSimilarity(
  rep: Representation,
  patterns: Representation[],
  engine: RepresentationEngine
): number {
  if (patterns.length === 0) return 0;

  let max = 0;
  for (const pattern of patterns) {
    const score = engine.similarity(rep, pattern);
    if (score > max) max = score;
  }
  return max;
}

/**
 * Assess dimension score based on similarity to high/low patterns
 * Returns 0-1 score weighted toward high patterns
 */
function assessDimension(
  rep: Representation,
  high: Representation[],
  low: Representation[],
  engine: RepresentationEngine
): number {
  const highScore = maxSimilarity(rep, high, engine);
  const lowScore = maxSimilarity(rep, low, engine);

  // If both are zero, return neutral
  if (highScore === 0 && lowScore === 0) return 0.5;

  // Weighted toward whichever is stronger
  const total = highScore + lowScore;
  return highScore / total;
}

/**
 * Assess sensitivity via similarity to reference patterns
 * Higher score = more sensitive content
 */
export function assessSensitivity(
  rep: Representation,
  context: AssessmentContext
): number {
  return assessDimension(
    rep,
    context.referencePatterns.sensitivity.high,
    context.referencePatterns.sensitivity.low,
    context.engine
  );
}

/**
 * Assess accuracy requirement via similarity to reference patterns
 * Higher score = requires more accuracy
 */
export function assessAccuracyRequirement(
  rep: Representation,
  context: AssessmentContext
): number {
  return assessDimension(
    rep,
    context.referencePatterns.accuracy.high,
    context.referencePatterns.accuracy.low,
    context.engine
  );
}

/**
 * Assess privilege level via similarity to reference patterns
 * Higher score = requires higher privilege
 */
export function assessPrivilegeLevel(
  rep: Representation,
  context: AssessmentContext
): number {
  return assessDimension(
    rep,
    context.referencePatterns.privilege.high,
    context.referencePatterns.privilege.low,
    context.engine
  );
}

/**
 * Assess all dimensions at once
 */
export interface AssessmentResult {
  sensitivity: number;
  accuracy: number;
  privilege: number;
}

export function assessAll(
  rep: Representation,
  context: AssessmentContext
): AssessmentResult {
  return {
    sensitivity: assessSensitivity(rep, context),
    accuracy: assessAccuracyRequirement(rep, context),
    privilege: assessPrivilegeLevel(rep, context)
  };
}
