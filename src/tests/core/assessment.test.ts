/**
 * Semantic MTS Assessment Tests
 * TDD-Light: Verify assessment structure and bounds
 * Note: Mock engine uses hash-based vectors, not semantic embeddings
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createMockEngine } from '../../core/representation';
import type { RepresentationEngine } from '../../core/representation/engine';
import { encodeReferencePatterns } from '../../core/tiers/reference-patterns';
import type { ReferencePatterns } from '../../core/tiers/reference-patterns';
import {
  assessSensitivity,
  assessAccuracyRequirement,
  assessPrivilegeLevel,
  assessAll,
  type AssessmentContext
} from '../../core/tiers/assessment';

describe('Semantic MTS Assessment', () => {
  let engine: RepresentationEngine;
  let patterns: ReferencePatterns;
  let context: AssessmentContext;

  beforeAll(async () => {
    engine = createMockEngine();
    patterns = await encodeReferencePatterns(engine);
    context = { engine, referencePatterns: patterns };
  });

  describe('Sensitivity Assessment', () => {
    it('returns a valid score between 0 and 1', async () => {
      const rep = await engine.encode('test content');
      const score = assessSensitivity(rep, context);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('is deterministic for same input', async () => {
      const rep = await engine.encode('deterministic test');
      const score1 = assessSensitivity(rep, context);
      const score2 = assessSensitivity(rep, context);

      expect(score1).toBe(score2);
    });

    it('different content produces (potentially) different scores', async () => {
      const rep1 = await engine.encode('first unique content');
      const rep2 = await engine.encode('second unique content');
      const score1 = assessSensitivity(rep1, context);
      const score2 = assessSensitivity(rep2, context);

      // Scores should be valid (not necessarily different with mock engine)
      expect(score1).toBeGreaterThanOrEqual(0);
      expect(score2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Accuracy Requirement Assessment', () => {
    it('returns a valid score between 0 and 1', async () => {
      const rep = await engine.encode('test content');
      const score = assessAccuracyRequirement(rep, context);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('is deterministic for same input', async () => {
      const rep = await engine.encode('deterministic test');
      const score1 = assessAccuracyRequirement(rep, context);
      const score2 = assessAccuracyRequirement(rep, context);

      expect(score1).toBe(score2);
    });
  });

  describe('Privilege Level Assessment', () => {
    it('returns a valid score between 0 and 1', async () => {
      const rep = await engine.encode('test content');
      const score = assessPrivilegeLevel(rep, context);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('is deterministic for same input', async () => {
      const rep = await engine.encode('deterministic test');
      const score1 = assessPrivilegeLevel(rep, context);
      const score2 = assessPrivilegeLevel(rep, context);

      expect(score1).toBe(score2);
    });
  });

  describe('Combined Assessment', () => {
    it('assessAll returns all three dimensions', async () => {
      const rep = await engine.encode('some test content');
      const result = assessAll(rep, context);

      expect(result).toHaveProperty('sensitivity');
      expect(result).toHaveProperty('accuracy');
      expect(result).toHaveProperty('privilege');

      expect(typeof result.sensitivity).toBe('number');
      expect(typeof result.accuracy).toBe('number');
      expect(typeof result.privilege).toBe('number');
    });

    it('all scores are between 0 and 1', async () => {
      const rep = await engine.encode('random test content');
      const result = assessAll(rep, context);

      expect(result.sensitivity).toBeGreaterThanOrEqual(0);
      expect(result.sensitivity).toBeLessThanOrEqual(1);
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
      expect(result.privilege).toBeGreaterThanOrEqual(0);
      expect(result.privilege).toBeLessThanOrEqual(1);
    });

    it('assessment is deterministic for same input', async () => {
      const rep = await engine.encode('deterministic test content');
      const result1 = assessAll(rep, context);
      const result2 = assessAll(rep, context);

      expect(result1).toEqual(result2);
    });
  });

  describe('Reference Pattern Encoding', () => {
    it('encodes all sensitivity patterns', () => {
      expect(patterns.sensitivity.high.length).toBeGreaterThan(0);
      expect(patterns.sensitivity.low.length).toBeGreaterThan(0);
    });

    it('encodes all accuracy patterns', () => {
      expect(patterns.accuracy.high.length).toBeGreaterThan(0);
      expect(patterns.accuracy.low.length).toBeGreaterThan(0);
    });

    it('encodes all privilege patterns', () => {
      expect(patterns.privilege.high.length).toBeGreaterThan(0);
      expect(patterns.privilege.low.length).toBeGreaterThan(0);
    });

    it('patterns have correct model ID', () => {
      patterns.sensitivity.high.forEach(rep => {
        expect(rep.modelId).toBe('mock-engine-v1');
      });
    });
  });
});
