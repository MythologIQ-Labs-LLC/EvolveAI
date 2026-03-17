/**
 * Neural Net Processor Configuration
 * Unified configuration for all subsystems
 */

import type { LifecycleConfig, DEFAULT_LIFECYCLE_CONFIG } from '../lifecycle/types';
import type { DecayConfig, DEFAULT_DECAY_CONFIG } from '../memory/decay';
import type { MTSWeights, TierThresholds, DEFAULT_MTS_WEIGHTS, DEFAULT_TIER_THRESHOLDS } from '../tiers/types';
import type { L1CacheConfig, DEFAULT_L1_CONFIG } from '../tiers/l1-cache';
import type { L2GraphConfig, DEFAULT_L2_CONFIG } from '../tiers/l2-graph';
import type { L3VaultConfig, DEFAULT_L3_CONFIG } from '../tiers/l3-vault';
import type { ShadowGenomeConfig, DEFAULT_SHADOW_CONFIG } from '../shadow/genome';
import type { InterceptorConfig, DEFAULT_INTERCEPTOR_CONFIG } from '../shadow/interceptor';

/**
 * Full processor configuration
 */
export interface ProcessorConfig {
  /** Lifecycle orchestrator config */
  lifecycle: LifecycleConfig;
  /** Memory decay config */
  decay: DecayConfig;
  /** Tier routing weights */
  mtsWeights: MTSWeights;
  /** Tier thresholds */
  tierThresholds: TierThresholds;
  /** L1 cache config */
  l1Cache: L1CacheConfig;
  /** L2 graph config */
  l2Graph: L2GraphConfig;
  /** L3 vault config */
  l3Vault: L3VaultConfig;
  /** Shadow genome config */
  shadowGenome: ShadowGenomeConfig;
  /** Shadow interceptor config */
  interceptor: InterceptorConfig;
  /** Embedding configuration */
  embedding: EmbeddingConfig;
}

/**
 * Embedding configuration
 */
export interface EmbeddingConfig {
  /** Embedding model to use */
  model: 'minilm' | 'custom';
  /** Embedding dimensions */
  dimensions: 384 | 768;
  /** Whether to cache embeddings */
  cacheEmbeddings: boolean;
}

/**
 * Default processor configuration
 */
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  lifecycle: { ...DEFAULT_LIFECYCLE_CONFIG },
  decay: { ...DEFAULT_DECAY_CONFIG },
  mtsWeights: { ...DEFAULT_MTS_WEIGHTS },
  tierThresholds: { ...DEFAULT_TIER_THRESHOLDS },
  l1Cache: { ...DEFAULT_L1_CONFIG },
  l2Graph: { ...DEFAULT_L2_CONFIG },
  l3Vault: { ...DEFAULT_L3_CONFIG },
  shadowGenome: { ...DEFAULT_SHADOW_CONFIG },
  interceptor: { ...DEFAULT_INTERCEPTOR_CONFIG },
  embedding: {
    model: 'minilm',
    dimensions: 384,
    cacheEmbeddings: true
  }
};

/**
 * Create processor config with overrides
 */
export function createProcessorConfig(
  overrides: Partial<ProcessorConfig> = {}
): ProcessorConfig {
  return {
    lifecycle: { ...DEFAULT_PROCESSOR_CONFIG.lifecycle, ...overrides.lifecycle },
    decay: { ...DEFAULT_PROCESSOR_CONFIG.decay, ...overrides.decay },
    mtsWeights: { ...DEFAULT_PROCESSOR_CONFIG.mtsWeights, ...overrides.mtsWeights },
    tierThresholds: { ...DEFAULT_PROCESSOR_CONFIG.tierThresholds, ...overrides.tierThresholds },
    l1Cache: { ...DEFAULT_PROCESSOR_CONFIG.l1Cache, ...overrides.l1Cache },
    l2Graph: { ...DEFAULT_PROCESSOR_CONFIG.l2Graph, ...overrides.l2Graph },
    l3Vault: { ...DEFAULT_PROCESSOR_CONFIG.l3Vault, ...overrides.l3Vault },
    shadowGenome: { ...DEFAULT_PROCESSOR_CONFIG.shadowGenome, ...overrides.shadowGenome },
    interceptor: { ...DEFAULT_PROCESSOR_CONFIG.interceptor, ...overrides.interceptor },
    embedding: { ...DEFAULT_PROCESSOR_CONFIG.embedding, ...overrides.embedding }
  };
}

/**
 * Validate processor configuration
 */
export function validateConfig(config: ProcessorConfig): string[] {
  const errors: string[] = [];

  // Validate tier thresholds
  if (config.tierThresholds.l3 <= config.tierThresholds.l2) {
    errors.push('L3 threshold must be greater than L2 threshold');
  }

  // Validate MTS weights sum
  const weightSum =
    config.mtsWeights.sensitivity +
    config.mtsWeights.accuracy +
    config.mtsWeights.privilege +
    config.mtsWeights.compute;

  if (Math.abs(weightSum - 1.0) > 0.01) {
    errors.push(`MTS weights should sum to 1.0, got ${weightSum}`);
  }

  // Validate positive values
  if (config.l1Cache.maxSize <= 0) {
    errors.push('L1 cache maxSize must be positive');
  }

  if (config.lifecycle.synthesisThreshold <= 0) {
    errors.push('Synthesis threshold must be positive');
  }

  if (config.interceptor.safetyThreshold < 0 || config.interceptor.safetyThreshold > 1) {
    errors.push('Safety threshold must be between 0 and 1');
  }

  return errors;
}

/**
 * Create minimal config for testing
 */
export function createMinimalConfig(): ProcessorConfig {
  return {
    ...DEFAULT_PROCESSOR_CONFIG,
    l1Cache: {
      ...DEFAULT_PROCESSOR_CONFIG.l1Cache,
      maxSize: 100
    },
    lifecycle: {
      ...DEFAULT_PROCESSOR_CONFIG.lifecycle,
      synthesisThreshold: 5
    }
  };
}
