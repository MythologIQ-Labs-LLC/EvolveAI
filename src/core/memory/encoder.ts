/**
 * Memory Encoder - Transform raw inputs into MemoryUnits
 * Section 4 Razor: Single responsibility - encoding pipeline
 */

import { generateUorId, generateSessionId } from '../../lib/utils/id';
import { now } from '../../lib/utils/time';
import { getLambdaForTier, DEFAULT_DECAY_CONFIG } from './decay';
import type { MemoryUnit, RawInput, Tier, Phase, MemoryMetadata } from './types';

export interface EncoderConfig {
  embeddingDimension: number;
  defaultW0: number;
  mtsWeights: MTSWeights;
}

export interface MTSWeights {
  sensitivity: number;
  accuracy: number;
  privilege: number;
  compute: number;
}

export const DEFAULT_ENCODER_CONFIG: EncoderConfig = {
  embeddingDimension: 384,
  defaultW0: 1.0,
  mtsWeights: {
    sensitivity: 0.3,
    accuracy: 0.3,
    privilege: 0.2,
    compute: 0.2
  }
};

export interface EncodingContext {
  session_id: string;
  phase: Phase;
  computeConstraint: number;
}

/**
 * Calculate Memory Tier Score
 * MTS = (S×Ws) + (A×Wa) + (P×Wp) - (C×Wc)
 */
export function calculateMTS(
  sensitivity: number,
  accuracy: number,
  privilege: number,
  computeConstraint: number,
  weights: MTSWeights
): number {
  return (
    sensitivity * weights.sensitivity +
    accuracy * weights.accuracy +
    privilege * weights.privilege -
    computeConstraint * weights.compute
  );
}

export function determineTier(mtsScore: number): Tier {
  if (mtsScore > 0.8) return 'L3';
  if (mtsScore > 0.3) return 'L2';
  return 'L1';
}

export function assessSensitivity(content: unknown): number {
  // Placeholder: In production, analyze content for PII, secrets, etc.
  return 0.5;
}

export function assessAccuracyRequirement(content: unknown): number {
  // Placeholder: Determine hallucination tolerance
  return 0.5;
}

export function assessPrivilegeLevel(content: unknown): number {
  // Placeholder: Determine required access clearance
  return 0.5;
}

/**
 * Encode raw input into MemoryUnit
 * Pipeline: Normalize → Embed → Hash → Classify → Create
 */
export async function encode(
  input: RawInput,
  context: EncodingContext,
  embedFn: (content: unknown) => Promise<Float32Array>,
  config: EncoderConfig = DEFAULT_ENCODER_CONFIG
): Promise<MemoryUnit> {
  // Step 1: Generate embedding
  const embedding = await embedFn(input.content);

  // Step 2: Generate content-addressed hash
  const uor_id = generateUorId(input.content);

  // Step 3: Calculate MTS and determine tier
  const sensitivity = assessSensitivity(input.content);
  const accuracy = assessAccuracyRequirement(input.content);
  const privilege = assessPrivilegeLevel(input.content);
  const mts_score = calculateMTS(
    sensitivity,
    accuracy,
    privilege,
    context.computeConstraint,
    config.mtsWeights
  );
  const tier = determineTier(mts_score);

  // Step 4: Build metadata
  const metadata: MemoryMetadata = {
    t_0: now(),
    w_0: input.metadata?.w_0 ?? config.defaultW0,
    lambda: input.metadata?.lambda ?? getLambdaForTier(tier),
    mts_score,
    tier,
    source_phase: input.sourcePhase ?? context.phase,
    session_id: context.session_id
  };

  return { uor_id, content: input.content, embedding, metadata };
}
