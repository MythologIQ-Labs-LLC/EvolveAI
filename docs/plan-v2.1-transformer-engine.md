# Plan: v2.1 TransformerEngine - Real ML Embeddings

## Open Questions

None. All resolved:
1. **Package name**: Use `@huggingface/transformers` (v3+, not `@xenova/transformers`)
2. **Model**: `Xenova/all-MiniLM-L6-v2` (384 dimensions, good all-rounder)
3. **Quantization**: Support `dtype` options (fp32, q8, q4) via config

---

## Phase 1: TransformerEngine Implementation

### Affected Files

- `src/core/representation/transformer-engine.ts` - NEW: Real ML engine
- `src/core/representation/engine.ts` - Add 'huggingface' type to EngineConfig
- `src/core/representation/index.ts` - Export TransformerEngine

### Changes

**src/core/representation/transformer-engine.ts**

```typescript
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
import { cosineSimilarity, euclideanDistance, dotProduct, euclideanToSimilarity } from './similarity';

// Lazy-load to avoid blocking startup
type Pipeline = Awaited<ReturnType<typeof import('@huggingface/transformers').pipeline>>;

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
   * Create and initialize transformer engine.
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

    const results: Representation[] = [];
    const batchSize = contents.length;
    const vecSize = output.dims[1];

    for (let i = 0; i < batchSize; i++) {
      const start = i * vecSize;
      const vector = new Float32Array(output.data.slice(start, start + vecSize));
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
    const headerLength = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, false);
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
}

/**
 * Create transformer engine instance
 */
export function createTransformerEngine(
  config?: Partial<TransformerEngineConfig>
): TransformerEngine {
  return TransformerEngine.create(config);
}
```

**src/core/representation/engine.ts** - Update EngineConfig type

```typescript
export interface EngineConfig {
  type: 'transformer' | 'mock';
  modelId?: string;
  dimensions?: number;
  /** Quantization for transformer engine */
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4';
}
```

**src/core/representation/index.ts** - Add exports

```typescript
// Transformer engine (requires @huggingface/transformers)
export {
  TransformerEngine,
  createTransformerEngine,
  DEFAULT_TRANSFORMER_CONFIG
} from './transformer-engine';
export type { TransformerEngineConfig } from './transformer-engine';
```

### Unit Tests

- `src/tests/core/transformer-engine.test.ts`
  - Engine creates with default config
  - Engine creates with custom config (different model, dtype)
  - `encode()` returns valid Representation with correct modelId
  - `encodeBatch()` returns array matching input length
  - Identical content produces identical embeddings
  - Similar content has cosine similarity > 0.7
  - Different content has cosine similarity < 0.5
  - `similarity()` supports all three strategies
  - Serialization roundtrip preserves representation
  - `isNative()` returns true for same-model representations

---

## Phase 2: Engine Factory Function

### Affected Files

- `src/core/representation/factory.ts` - NEW: Unified engine creation
- `src/core/representation/index.ts` - Export factory

### Changes

**src/core/representation/factory.ts**

```typescript
/**
 * Engine Factory
 * Unified creation of representation engines
 */

import type { RepresentationEngine, EngineConfig } from './engine';
import { DEFAULT_ENGINE_CONFIG } from './engine';
import { createMockEngine } from './mock-engine';
import { createTransformerEngine } from './transformer-engine';

/**
 * Create representation engine from config.
 * Defaults to mock engine for testing.
 */
export async function createEngine(
  config: Partial<EngineConfig> = {}
): Promise<RepresentationEngine> {
  const merged = { ...DEFAULT_ENGINE_CONFIG, ...config };

  switch (merged.type) {
    case 'transformer':
      return createTransformerEngine({
        modelId: merged.modelId ?? 'Xenova/all-MiniLM-L6-v2',
        dtype: merged.dtype ?? 'fp32',
        pooling: 'mean',
        normalize: true
      });

    case 'mock':
    default:
      return createMockEngine({
        modelId: merged.modelId,
        dimensions: merged.dimensions
      });
  }
}
```

**src/core/representation/index.ts** - Add factory export

```typescript
// Factory
export { createEngine } from './factory';
```

### Unit Tests

- `src/tests/core/engine-factory.test.ts`
  - `createEngine()` defaults to MockEngine
  - `createEngine({ type: 'mock' })` returns MockEngine
  - `createEngine({ type: 'transformer' })` returns TransformerEngine
  - Factory passes through config options correctly

---

## Phase 3: Package Integration

### Affected Files

- `package.json` - Add @huggingface/transformers dependency

### Changes

**package.json** - Add dependency

```json
{
  "dependencies": {
    "@huggingface/transformers": "^3.0.0"
  }
}
```

Note: The transformer engine uses dynamic `import()` so the dependency is only loaded when `type: 'transformer'` is specified. This keeps the mock engine path zero-dependency.

### Unit Tests

- Integration test that verifies dynamic import works
- Test that mock engine still works without transformer package being loaded

---

## Summary

| Phase | Focus | Files | Key Deliverable |
|-------|-------|-------|-----------------|
| 1 | TransformerEngine | 3 | Real ML embeddings via HuggingFace |
| 2 | Engine Factory | 2 | Unified engine creation API |
| 3 | Package Integration | 1 | Dependency management |

### Design Principles Applied

1. **Simple over Easy**: Lazy loading defers complexity until needed
2. **Values over State**: Representations remain immutable
3. **Declarative Config**: Engine behavior specified via config objects
4. **Composable**: Mock and Transformer engines are interchangeable via interface

### Backwards Compatibility

- MockEngine remains default (no breaking changes)
- Existing code using `createMockEngine()` unchanged
- New `createEngine()` factory provides unified API

---

_Plan follows Simple Made Easy principles_
