/**
 * Representation Module
 * Model-agnostic content representation abstraction
 */

// Types
export type {
  Representation,
  SimilarityStrategy,
  CrossModelResult,
  EngineCapabilities,
  RepresentationHeader
} from './types.js';

export {
  REPRESENTATION_VERSION,
  createRepresentation,
  extractVector,
  parseHeader
} from './types.js';

// Engine interface
export type { RepresentationEngine, EngineConfig } from './engine.js';
export { DEFAULT_ENGINE_CONFIG } from './engine.js';

// Mock engine (for testing and development)
export { MockEngine, createMockEngine } from './mock-engine.js';

// Similarity functions
export {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  euclideanToSimilarity,
  normalize
} from './similarity.js';

// Transformer engine (requires @huggingface/transformers)
export {
  TransformerEngine,
  createTransformerEngine,
  DEFAULT_TRANSFORMER_CONFIG
} from './transformer-engine.js';
export type { TransformerEngineConfig } from './transformer-engine.js';

// Factory
export { createEngine } from './factory.js';
