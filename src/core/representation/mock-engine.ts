/**
 * Mock Representation Engine
 * Deterministic engine for testing and development
 * Uses hash-based embedding generation (no ML dependencies)
 */

import type { RepresentationEngine, EngineConfig } from './engine';
import type {
  Representation,
  SimilarityStrategy,
  CrossModelResult,
  EngineCapabilities
} from './types';
import { createRepresentation, extractVector } from './types';
import { cosineSimilarity, euclideanDistance, dotProduct, euclideanToSimilarity } from './similarity';

/**
 * Mock engine for testing without ML dependencies
 */
export class MockEngine implements RepresentationEngine {
  readonly modelId: string;
  readonly capabilities: EngineCapabilities = {
    supportedStrategies: ['cosine', 'euclidean', 'dot_product'],
    supportsBatch: true,
    supportsQuantization: false,
    supportsCrossModel: false
  };

  private dimensions: number;

  constructor(modelId: string = 'mock-engine-v1', dimensions: number = 384) {
    this.modelId = modelId;
    this.dimensions = dimensions;
  }

  /**
   * Create mock engine instance
   */
  static create(config?: Partial<EngineConfig>): MockEngine {
    return new MockEngine(
      config?.modelId ?? 'mock-engine-v1',
      config?.dimensions ?? 384
    );
  }

  async encode(content: string): Promise<Representation> {
    const vector = this.generateVector(content);
    return createRepresentation(this.modelId, vector);
  }

  async encodeBatch(contents: string[]): Promise<Representation[]> {
    return Promise.all(contents.map(c => this.encode(c)));
  }

  similarity(
    a: Representation,
    b: Representation,
    strategy: SimilarityStrategy = 'cosine'
  ): number {
    const vecA = extractVector(a);
    const vecB = extractVector(b);

    switch (strategy) {
      case 'cosine':
        return cosineSimilarity(vecA, vecB);
      case 'euclidean':
        return euclideanToSimilarity(euclideanDistance(vecA, vecB));
      case 'dot_product':
        return dotProduct(vecA, vecB);
      default:
        return cosineSimilarity(vecA, vecB);
    }
  }

  crossModelSimilarity(a: Representation, b: Representation): CrossModelResult {
    if (a.modelId !== b.modelId) {
      return {
        score: 0,
        degraded: true,
        reason: 'Cross-model comparison not supported'
      };
    }

    return {
      score: this.similarity(a, b),
      degraded: false
    };
  }

  serialize(rep: Representation): Uint8Array {
    return rep.bytes;
  }

  deserialize(bytes: Uint8Array): Representation {
    const headerLength = new DataView(
      bytes.buffer,
      bytes.byteOffset
    ).getUint32(0, false);

    const headerBytes = bytes.slice(4, 4 + headerLength);
    const headerJson = new TextDecoder().decode(headerBytes);
    const header = JSON.parse(headerJson);

    return {
      bytes,
      modelId: header.modelId,
      version: header.version
    };
  }

  isNative(rep: Representation): boolean {
    return rep.modelId === this.modelId;
  }

  /**
   * Generate deterministic vector from content
   * Uses hash-based approach for reproducibility
   */
  private generateVector(content: string): Float32Array {
    const vector = new Float32Array(this.dimensions);
    const hash = this.hashString(content);

    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = Math.sin(hash * (i + 1) * 0.001) * 0.5;
    }

    return this.normalizeVector(vector);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  private normalizeVector(v: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < v.length; i++) {
      norm += v[i] * v[i];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) return v;

    for (let i = 0; i < v.length; i++) {
      v[i] = v[i] / norm;
    }

    return v;
  }
}

/**
 * Create mock engine instance
 */
export function createMockEngine(config?: Partial<EngineConfig>): MockEngine {
  return MockEngine.create(config);
}
