/**
 * Representation Engine Tests
 * TDD-Light: Verify Reality matches Promise
 */

import { describe, it, expect } from 'vitest';
import {
  createMockEngine,
  createRepresentation,
  extractVector,
  cosineSimilarity,
  euclideanDistance,
  dotProduct
} from '../../core/representation';

describe('MockEngine', () => {
  it('creates valid representation with correct modelId', async () => {
    const engine = createMockEngine({ modelId: 'test-model' });
    const rep = await engine.encode('hello world');

    expect(rep.modelId).toBe('test-model');
    expect(rep.version).toBe(1);
    expect(rep.bytes).toBeInstanceOf(Uint8Array);
    expect(rep.bytes.length).toBeGreaterThan(0);
  });

  it('batch encoding returns array matching input length', async () => {
    const engine = createMockEngine();
    const contents = ['first', 'second', 'third'];
    const reps = await engine.encodeBatch(contents);

    expect(reps).toHaveLength(3);
    reps.forEach(rep => {
      expect(rep.modelId).toBe('mock-engine-v1');
    });
  });

  it('similar content has similarity > 0.7', async () => {
    const engine = createMockEngine();
    const rep1 = await engine.encode('hello world');
    const rep2 = await engine.encode('hello world'); // Identical content

    const score = engine.similarity(rep1, rep2);
    expect(score).toBeGreaterThan(0.7);
  });

  it('identical content has similarity = 1.0', async () => {
    const engine = createMockEngine();
    const rep1 = await engine.encode('test content');
    const rep2 = await engine.encode('test content');

    const score = engine.similarity(rep1, rep2);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('different content has lower similarity', async () => {
    const engine = createMockEngine();
    const rep1 = await engine.encode('hello world');
    const rep2 = await engine.encode('goodbye universe completely different');

    const score = engine.similarity(rep1, rep2);
    expect(score).toBeLessThan(1.0);
  });

  it('serialize/deserialize roundtrip preserves representation', async () => {
    const engine = createMockEngine();
    const original = await engine.encode('test content');

    const serialized = engine.serialize(original);
    const deserialized = engine.deserialize(serialized);

    expect(deserialized.modelId).toBe(original.modelId);
    expect(deserialized.version).toBe(original.version);
    expect(deserialized.bytes).toEqual(original.bytes);
  });

  it('isNative returns true for same-model representations', async () => {
    const engine = createMockEngine({ modelId: 'my-model' });
    const rep = await engine.encode('test');

    expect(engine.isNative(rep)).toBe(true);
  });

  it('isNative returns false for different-model representations', async () => {
    const engine1 = createMockEngine({ modelId: 'model-a' });
    const engine2 = createMockEngine({ modelId: 'model-b' });
    const rep = await engine1.encode('test');

    expect(engine2.isNative(rep)).toBe(false);
  });

  it('cross-model comparison returns degraded: true for different models', async () => {
    const engine = createMockEngine({ modelId: 'my-model' });
    const rep1 = await engine.encode('test');
    const rep2 = createRepresentation('other-model', new Float32Array(384));

    const result = engine.crossModelSimilarity(rep1, rep2);
    expect(result.degraded).toBe(true);
    expect(result.score).toBe(0);
  });

  it('cross-model comparison returns degraded: false for same model', async () => {
    const engine = createMockEngine();
    const rep1 = await engine.encode('test');
    const rep2 = await engine.encode('test');

    const result = engine.crossModelSimilarity(rep1, rep2);
    expect(result.degraded).toBe(false);
  });
});

describe('Similarity Functions', () => {
  it('cosine similarity of identical vectors = 1.0', () => {
    const v = new Float32Array([1, 2, 3, 4]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('cosine similarity of orthogonal vectors = 0.0', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('euclidean distance of identical vectors = 0.0', () => {
    const v = new Float32Array([1, 2, 3]);
    expect(euclideanDistance(v, v)).toBe(0);
  });

  it('dot product matches manual calculation', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    expect(dotProduct(a, b)).toBe(32);
  });
});

describe('Representation Creation', () => {
  it('creates representation with correct structure', () => {
    const vector = new Float32Array([0.1, 0.2, 0.3]);
    const rep = createRepresentation('test-model', vector);

    expect(rep.modelId).toBe('test-model');
    expect(rep.version).toBe(1);
    expect(rep.bytes).toBeInstanceOf(Uint8Array);
  });

  it('extractVector recovers original vector', () => {
    const original = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const rep = createRepresentation('test', original);
    const extracted = extractVector(rep);

    expect(extracted.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(extracted[i]).toBeCloseTo(original[i], 5);
    }
  });
});
