/**
 * Transformer Representation Engine
 * Real ML embeddings via @huggingface/transformers
 */

import type { RepresentationEngine } from './engine';
import type {
  Representation,
  SimilarityStrategy,
  CrossModelResult,
  EngineCapabilities
} from './types';
import { createRepresentation, extractVector } from './types';
import {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  euclideanToSimilarity
} from './similarity';

/** Pipeline type from @huggingface/transformers */
type Pipeline = Awaited<ReturnType<typeof import('@huggingface/transformers').pipeline>>;

/**
 * Transformer engine configuration
 */
export interface TransformerEngineConfig {
  /** Model ID from Hugging Face Hub */
  modelId: string;
  /** Quantization level for memory/speed tradeoff */
  dtype: 'fp32' | 'fp16' | 'q8' | 'q4';
  /** Pooling strategy for embeddings */
  pooling: 'mean' | 'cls';
  /** Normalize output vectors */
  normalize: boolean;
}

export const DEFAULT_TRANSFORMER_CONFIG: TransformerEngineConfig = {
  modelId: 'Xenova/all-MiniLM-L6-v2',
  dtype: 'fp32',
  pooling: 'mean',
  normalize: true
};

/**
 * Transformer-based representation engine
 * Uses @huggingface/transformers for real ML embeddings
 */
export class TransformerEngine implements RepresentationEngine {
  readonly modelId: string;
  readonly capabilities: EngineCapabilities = {
    supportedStrategies: ['cosine', 'euclidean', 'dot_product'],
    supportsBatch: true,
    supportsQuantization: true,
    supportsCrossModel: false
  };

  private config: TransformerEngineConfig;
  private pipeline: Pipeline | null = null;
  private dimensions: number = 0;
  private initPromise: Promise<void> | null = null;

  private constructor(config: TransformerEngineConfig) {
    this.config = config;
    this.modelId = config.modelId;
  }

  /**
   * Create transformer engine instance.
   * Pipeline is loaded lazily on first encode call.
   */
  static create(config?: Partial<TransformerEngineConfig>): TransformerEngine {
    return new TransformerEngine({ ...DEFAULT_TRANSFORMER_CONFIG, ...config });
  }

  /**
   * Ensure pipeline is initialized (lazy loading)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.pipeline) return;

    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }

    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    const { pipeline } = await import('@huggingface/transformers');

    this.pipeline = await pipeline('feature-extraction', this.config.modelId, {
      dtype: this.config.dtype
    });

    // Probe dimensions with a test encoding
    const testOutput = await this.pipeline('test', {
      pooling: this.config.pooling,
      normalize: this.config.normalize
    });

    this.dimensions = testOutput.dims[1];
  }

  async encode(content: string): Promise<Representation> {
    await this.ensureInitialized();

    const output = await this.pipeline!(content, {
      pooling: this.config.pooling,
      normalize: this.config.normalize
    });

    const vector = new Float32Array(output.data);
    return createRepresentation(this.modelId, vector);
  }

  async encodeBatch(contents: string[]): Promise<Representation[]> {
    await this.ensureInitialized();

    const output = await this.pipeline!(contents, {
      pooling: this.config.pooling,
      normalize: this.config.normalize
    });

    return this.extractBatchResults(output, contents.length);
  }

  private extractBatchResults(output: unknown, batchSize: number): Representation[] {
    const results: Representation[] = [];
    const typedOutput = output as { data: ArrayLike<number>; dims: number[] };
    const vecSize = typedOutput.dims[1];

    for (let i = 0; i < batchSize; i++) {
      const start = i * vecSize;
      const vector = new Float32Array(
        Array.from(typedOutput.data).slice(start, start + vecSize)
      );
      results.push(createRepresentation(this.modelId, vector));
    }

    return results;
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
   * Get dimensions after initialization
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.pipeline !== null;
  }
}

/**
 * Create transformer engine instance
 */
export function createTransformerEngine(
  config?: Partial<TransformerEngineConfig>
): TransformerEngine {
  return TransformerEngine.create(config);
}
