/**
 * Representation Types
 * Model-agnostic abstractions for content representation
 */

/**
 * Opaque representation of content.
 * Memory system never inspects internals—only passes to engine.
 */
export interface Representation {
  /** Serialized form (opaque to consumers) */
  readonly bytes: Uint8Array;
  /** Model that produced this representation */
  readonly modelId: string;
  /** Schema version for migration */
  readonly version: number;
}

/**
 * Similarity computation strategies.
 * Engine implementations may support a subset.
 */
export type SimilarityStrategy =
  | 'cosine'        // Default: angle between vectors
  | 'euclidean'     // Distance-based
  | 'dot_product'   // Fast when normalized
  | 'maxsim'        // ColBERT-style token-level max
  | 'hybrid';       // Dense + sparse fusion

/**
 * Result of cross-model comparison.
 */
export interface CrossModelResult {
  /** Similarity score */
  score: number;
  /** True if comparison is approximate due to model mismatch */
  degraded: boolean;
  /** Explanation if degraded */
  reason?: string;
}

/**
 * Engine capabilities for feature detection.
 */
export interface EngineCapabilities {
  /** Supported similarity strategies */
  supportedStrategies: SimilarityStrategy[];
  /** Whether batch encoding is supported */
  supportsBatch: boolean;
  /** Whether quantized storage is supported */
  supportsQuantization: boolean;
  /** Whether cross-model comparison is supported */
  supportsCrossModel: boolean;
}

/**
 * Representation header for serialization.
 * Stored at the beginning of bytes for deserialization.
 */
export interface RepresentationHeader {
  /** Model identifier */
  modelId: string;
  /** Schema version */
  version: number;
  /** Dimensions of the vector (for transformer models) */
  dimensions: number;
  /** Byte offset where payload starts */
  payloadOffset: number;
}

/**
 * Current schema version for representations.
 */
export const REPRESENTATION_VERSION = 1;

/**
 * Create a representation from vector data.
 */
export function createRepresentation(
  modelId: string,
  vector: Float32Array
): Representation {
  const header: RepresentationHeader = {
    modelId,
    version: REPRESENTATION_VERSION,
    dimensions: vector.length,
    payloadOffset: 0 // Will be calculated
  };

  // Serialize header as JSON
  const headerJson = JSON.stringify(header);
  const headerBytes = new TextEncoder().encode(headerJson);

  // Create length prefix (4 bytes, big-endian)
  const lengthPrefix = new Uint8Array(4);
  new DataView(lengthPrefix.buffer).setUint32(0, headerBytes.length, false);

  // Create payload from vector
  const payload = new Uint8Array(vector.buffer);

  // Combine: [length prefix][header][payload]
  const totalLength = 4 + headerBytes.length + payload.length;
  const bytes = new Uint8Array(totalLength);
  bytes.set(lengthPrefix, 0);
  bytes.set(headerBytes, 4);
  bytes.set(payload, 4 + headerBytes.length);

  return {
    bytes,
    modelId,
    version: REPRESENTATION_VERSION
  };
}

/**
 * Extract vector from representation.
 */
export function extractVector(rep: Representation): Float32Array {
  // Read header length
  const headerLength = new DataView(rep.bytes.buffer, rep.bytes.byteOffset).getUint32(0, false);

  // Calculate payload offset
  const payloadOffset = 4 + headerLength;

  // Extract payload as Float32Array
  const payloadBytes = rep.bytes.slice(payloadOffset);
  return new Float32Array(payloadBytes.buffer, payloadBytes.byteOffset, payloadBytes.length / 4);
}

/**
 * Parse header from representation.
 */
export function parseHeader(rep: Representation): RepresentationHeader {
  // Read header length
  const headerLength = new DataView(rep.bytes.buffer, rep.bytes.byteOffset).getUint32(0, false);

  // Extract header bytes
  const headerBytes = rep.bytes.slice(4, 4 + headerLength);
  const headerJson = new TextDecoder().decode(headerBytes);

  return JSON.parse(headerJson);
}
