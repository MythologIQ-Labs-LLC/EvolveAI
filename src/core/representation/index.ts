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
} from './types';

export {
  REPRESENTATION_VERSION,
  createRepresentation,
  extractVector,
  parseHeader
} from './types';

// Engine interface
export type { RepresentationEngine, EngineConfig } from './engine';
export { DEFAULT_ENGINE_CONFIG } from './engine';

// Mock engine (for testing and development)
export { MockEngine, createMockEngine } from './mock-engine';

// Similarity functions
export {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  euclideanToSimilarity,
  normalize
} from './similarity';

// Transformer engine (requires @huggingface/transformers)
export {
  TransformerEngine,
  createTransformerEngine,
  DEFAULT_TRANSFORMER_CONFIG
} from './transformer-engine';
export type { TransformerEngineConfig } from './transformer-engine';

// Factory
export { createEngine } from './factory';
