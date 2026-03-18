/**
 * Representation Engine
 * Core abstraction for content representation
 */

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
   */
  similarity(
    a: Representation,
    b: Representation,
    strategy?: SimilarityStrategy
  ): number;

  /**
   * Compare representations from different models.
   */
  crossModelSimilarity(
    a: Representation,
    b: Representation
  ): CrossModelResult;

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
  type: 'transformer' | 'mock';
  modelId?: string;
  dimensions?: number;
  /** Quantization for transformer engine */
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4';
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  type: 'mock',
  modelId: 'mock-engine-v1',
  dimensions: 384
};
