/**
 * Transformer Engine Tests
 * TDD-Light: Verify engine structure and sync operations
 * Note: Async encode tests skipped - require actual model download
 */

import { describe, it, expect } from 'vitest';
import {
  TransformerEngine,
  createTransformerEngine,
  DEFAULT_TRANSFORMER_CONFIG
} from '../../core/representation/transformer-engine';
import { createRepresentation, extractVector } from '../../core/representation/types';

describe('TransformerEngine', () => {
  describe('Configuration', () => {
    it('creates with default config', () => {
      const engine = createTransformerEngine();

      expect(engine.modelId).toBe(DEFAULT_TRANSFORMER_CONFIG.modelId);
      expect(engine.capabilities.supportsBatch).toBe(true);
      expect(engine.capabilities.supportsQuantization).toBe(true);
    });

    it('creates with custom model ID', () => {
      const engine = createTransformerEngine({
        modelId: 'Xenova/custom-model'
      });

      expect(engine.modelId).toBe('Xenova/custom-model');
    });

    it('creates with custom dtype', () => {
      const engine = createTransformerEngine({
        dtype: 'q8'
      });

      expect(engine.modelId).toBe(DEFAULT_TRANSFORMER_CONFIG.modelId);
    });

    it('creates with all custom options', () => {
      const engine = createTransformerEngine({
        modelId: 'Xenova/custom',
        dtype: 'q4',
        pooling: 'cls',
        normalize: false
      });

      expect(engine.modelId).toBe('Xenova/custom');
    });
  });

  describe('Capabilities', () => {
    it('supports cosine similarity', () => {
      const engine = createTransformerEngine();
      expect(engine.capabilities.supportedStrategies).toContain('cosine');
    });

    it('supports euclidean similarity', () => {
      const engine = createTransformerEngine();
      expect(engine.capabilities.supportedStrategies).toContain('euclidean');
    });

    it('supports dot product similarity', () => {
      const engine = createTransformerEngine();
      expect(engine.capabilities.supportedStrategies).toContain('dot_product');
    });

    it('supports batch encoding', () => {
      const engine = createTransformerEngine();
      expect(engine.capabilities.supportsBatch).toBe(true);
    });

    it('supports quantization', () => {
      const engine = createTransformerEngine();
      expect(engine.capabilities.supportsQuantization).toBe(true);
    });

    it('does not support cross-model comparison', () => {
      const engine = createTransformerEngine();
      expect(engine.capabilities.supportsCrossModel).toBe(false);
    });
  });

  describe('Similarity (with mock representations)', () => {
    it('computes cosine similarity between representations', () => {
      const engine = createTransformerEngine();
      const vecA = new Float32Array([1, 0, 0]);
      const vecB = new Float32Array([1, 0, 0]);
      const repA = createRepresentation('test-model', vecA);
      const repB = createRepresentation('test-model', vecB);

      const similarity = engine.similarity(repA, repB, 'cosine');

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('computes euclidean similarity between representations', () => {
      const engine = createTransformerEngine();
      const vecA = new Float32Array([1, 0, 0]);
      const vecB = new Float32Array([1, 0, 0]);
      const repA = createRepresentation('test-model', vecA);
      const repB = createRepresentation('test-model', vecB);

      const similarity = engine.similarity(repA, repB, 'euclidean');

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('computes dot product similarity', () => {
      const engine = createTransformerEngine();
      const vecA = new Float32Array([1, 2, 3]);
      const vecB = new Float32Array([4, 5, 6]);
      const repA = createRepresentation('test-model', vecA);
      const repB = createRepresentation('test-model', vecB);

      const similarity = engine.similarity(repA, repB, 'dot_product');

      expect(similarity).toBe(32); // 1*4 + 2*5 + 3*6 = 32
    });

    it('defaults to cosine similarity', () => {
      const engine = createTransformerEngine();
      const vecA = new Float32Array([1, 0, 0]);
      const vecB = new Float32Array([0, 1, 0]);
      const repA = createRepresentation('test-model', vecA);
      const repB = createRepresentation('test-model', vecB);

      const similarity = engine.similarity(repA, repB);

      expect(similarity).toBeCloseTo(0, 5); // Orthogonal vectors
    });
  });

  describe('Cross-Model Similarity', () => {
    it('returns degraded result for different models', () => {
      const engine = createTransformerEngine();
      const repA = createRepresentation('model-a', new Float32Array([1, 0]));
      const repB = createRepresentation('model-b', new Float32Array([1, 0]));

      const result = engine.crossModelSimilarity(repA, repB);

      expect(result.degraded).toBe(true);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('not supported');
    });

    it('returns non-degraded result for same models', () => {
      const engine = createTransformerEngine();
      const repA = createRepresentation('same-model', new Float32Array([1, 0]));
      const repB = createRepresentation('same-model', new Float32Array([1, 0]));

      const result = engine.crossModelSimilarity(repA, repB);

      expect(result.degraded).toBe(false);
      expect(result.score).toBeCloseTo(1.0, 5);
    });
  });

  describe('Serialization', () => {
    it('serialize returns representation bytes', () => {
      const engine = createTransformerEngine();
      const rep = createRepresentation('test', new Float32Array([1, 2, 3]));

      const serialized = engine.serialize(rep);

      expect(serialized).toBeInstanceOf(Uint8Array);
      expect(serialized).toBe(rep.bytes);
    });

    it('deserialize reconstructs representation', () => {
      const engine = createTransformerEngine();
      const original = createRepresentation('test-model', new Float32Array([1, 2, 3]));

      const deserialized = engine.deserialize(original.bytes);

      expect(deserialized.modelId).toBe('test-model');
      expect(deserialized.version).toBe(original.version);
    });

    it('roundtrip preserves representation', () => {
      const engine = createTransformerEngine();
      const original = createRepresentation('test-model', new Float32Array([1, 2, 3, 4]));

      const serialized = engine.serialize(original);
      const deserialized = engine.deserialize(serialized);
      const vector = extractVector(deserialized);

      expect(deserialized.modelId).toBe(original.modelId);
      expect(Array.from(vector)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('Native Check', () => {
    it('isNative returns true for same model', () => {
      const engine = createTransformerEngine({ modelId: 'my-model' });
      const rep = createRepresentation('my-model', new Float32Array([1]));

      expect(engine.isNative(rep)).toBe(true);
    });

    it('isNative returns false for different model', () => {
      const engine = createTransformerEngine({ modelId: 'my-model' });
      const rep = createRepresentation('other-model', new Float32Array([1]));

      expect(engine.isNative(rep)).toBe(false);
    });
  });

  describe('Initialization State', () => {
    it('starts uninitialized', () => {
      const engine = createTransformerEngine();

      expect(engine.isInitialized()).toBe(false);
    });

    it('dimensions are 0 before initialization', () => {
      const engine = createTransformerEngine();

      expect(engine.getDimensions()).toBe(0);
    });
  });
});

describe('DEFAULT_TRANSFORMER_CONFIG', () => {
  it('uses all-MiniLM-L6-v2 model', () => {
    expect(DEFAULT_TRANSFORMER_CONFIG.modelId).toBe('Xenova/all-MiniLM-L6-v2');
  });

  it('uses fp32 dtype', () => {
    expect(DEFAULT_TRANSFORMER_CONFIG.dtype).toBe('fp32');
  });

  it('uses mean pooling', () => {
    expect(DEFAULT_TRANSFORMER_CONFIG.pooling).toBe('mean');
  });

  it('normalizes output', () => {
    expect(DEFAULT_TRANSFORMER_CONFIG.normalize).toBe(true);
  });
});
