/**
 * Engine Factory
 * Unified creation of representation engines
 */

import type { RepresentationEngine, EngineConfig } from './engine.js';
import { DEFAULT_ENGINE_CONFIG } from './engine.js';
import { createMockEngine } from './mock-engine.js';
import { createTransformerEngine } from './transformer-engine.js';

/**
 * Create representation engine from config.
 * Defaults to mock engine for testing.
 */
export function createEngine(
  config: Partial<EngineConfig> = {}
): RepresentationEngine {
  const type = config.type ?? DEFAULT_ENGINE_CONFIG.type;

  switch (type) {
    case 'transformer':
      return createTransformerEngine({
        modelId: config.modelId ?? 'Xenova/all-MiniLM-L6-v2',
        dtype: config.dtype ?? 'fp32',
        pooling: 'mean',
        normalize: true
      });

    case 'mock':
    default:
      return createMockEngine({
        modelId: config.modelId ?? DEFAULT_ENGINE_CONFIG.modelId,
        dimensions: config.dimensions ?? DEFAULT_ENGINE_CONFIG.dimensions
      });
  }
}
