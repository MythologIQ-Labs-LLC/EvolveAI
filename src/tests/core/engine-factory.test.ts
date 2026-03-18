/**
 * Engine Factory Tests
 * TDD-Light: Verify factory creates correct engine types
 */

import { describe, it, expect } from 'vitest';
import { createEngine } from '../../core/representation/factory';
import { MockEngine } from '../../core/representation/mock-engine';
import { TransformerEngine } from '../../core/representation/transformer-engine';

describe('createEngine', () => {
  describe('Default Behavior', () => {
    it('defaults to MockEngine', () => {
      const engine = createEngine();

      expect(engine).toBeInstanceOf(MockEngine);
    });

    it('default engine has mock model ID', () => {
      const engine = createEngine();

      expect(engine.modelId).toBe('mock-engine-v1');
    });
  });

  describe('Mock Engine Creation', () => {
    it('creates MockEngine with explicit type', () => {
      const engine = createEngine({ type: 'mock' });

      expect(engine).toBeInstanceOf(MockEngine);
    });

    it('passes modelId to MockEngine', () => {
      const engine = createEngine({
        type: 'mock',
        modelId: 'custom-mock'
      });

      expect(engine.modelId).toBe('custom-mock');
    });

    it('passes dimensions to MockEngine', () => {
      const engine = createEngine({
        type: 'mock',
        dimensions: 128
      });

      expect(engine).toBeInstanceOf(MockEngine);
    });
  });

  describe('Transformer Engine Creation', () => {
    it('creates TransformerEngine with type transformer', () => {
      const engine = createEngine({ type: 'transformer' });

      expect(engine).toBeInstanceOf(TransformerEngine);
    });

    it('uses default model for transformer', () => {
      const engine = createEngine({ type: 'transformer' });

      expect(engine.modelId).toBe('Xenova/all-MiniLM-L6-v2');
    });

    it('passes custom modelId to TransformerEngine', () => {
      const engine = createEngine({
        type: 'transformer',
        modelId: 'Xenova/custom-model'
      });

      expect(engine.modelId).toBe('Xenova/custom-model');
    });

    it('passes dtype to TransformerEngine', () => {
      const engine = createEngine({
        type: 'transformer',
        dtype: 'q8'
      });

      expect(engine).toBeInstanceOf(TransformerEngine);
    });
  });

  describe('Engine Interface Compliance', () => {
    it('MockEngine has required interface methods', () => {
      const engine = createEngine({ type: 'mock' });

      expect(typeof engine.encode).toBe('function');
      expect(typeof engine.encodeBatch).toBe('function');
      expect(typeof engine.similarity).toBe('function');
      expect(typeof engine.crossModelSimilarity).toBe('function');
      expect(typeof engine.serialize).toBe('function');
      expect(typeof engine.deserialize).toBe('function');
      expect(typeof engine.isNative).toBe('function');
    });

    it('TransformerEngine has required interface methods', () => {
      const engine = createEngine({ type: 'transformer' });

      expect(typeof engine.encode).toBe('function');
      expect(typeof engine.encodeBatch).toBe('function');
      expect(typeof engine.similarity).toBe('function');
      expect(typeof engine.crossModelSimilarity).toBe('function');
      expect(typeof engine.serialize).toBe('function');
      expect(typeof engine.deserialize).toBe('function');
      expect(typeof engine.isNative).toBe('function');
    });

    it('both engines have capabilities', () => {
      const mockEngine = createEngine({ type: 'mock' });
      const transformerEngine = createEngine({ type: 'transformer' });

      expect(mockEngine.capabilities).toBeDefined();
      expect(transformerEngine.capabilities).toBeDefined();
      expect(Array.isArray(mockEngine.capabilities.supportedStrategies)).toBe(true);
      expect(Array.isArray(transformerEngine.capabilities.supportedStrategies)).toBe(true);
    });
  });
});
