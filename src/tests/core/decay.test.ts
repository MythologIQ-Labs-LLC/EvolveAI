/**
 * Tests: Decay Engine (CMHL)
 */

import { describe, it, expect } from 'vitest';
import {
  computeDecay,
  isMemoryAlive,
  shouldCrystallize,
  DEFAULT_DECAY_CONFIG
} from '../../core/memory/decay';

describe('Decay Engine (CMHL)', () => {
  describe('computeDecay', () => {
    it('should return initial weight when no time has passed', () => {
      const w0 = 1.0;
      const lambda = 0.1;
      const t0 = 1000;
      const tCurrent = 1000;

      const result = computeDecay(w0, lambda, t0, tCurrent);
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('should decay weight over time', () => {
      const w0 = 1.0;
      const lambda = 0.1;
      const t0 = 0;
      const tCurrent = 10;

      const result = computeDecay(w0, lambda, t0, tCurrent);
      // w = 1.0 * e^(-0.1 * 10) = e^(-1) ≈ 0.368
      expect(result).toBeCloseTo(0.368, 2);
    });

    it('should not decay when lambda is 0 (L3 immutable)', () => {
      const w0 = 1.0;
      const lambda = 0.0;
      const t0 = 0;
      const tCurrent = 100000;

      const result = computeDecay(w0, lambda, t0, tCurrent);
      expect(result).toBe(1.0);
    });

    it('should approach zero for large time values', () => {
      const w0 = 1.0;
      const lambda = 0.1;
      const t0 = 0;
      const tCurrent = 100;

      const result = computeDecay(w0, lambda, t0, tCurrent);
      expect(result).toBeLessThan(0.001);
    });
  });

  describe('isMemoryAlive', () => {
    it('should return true when weight is above threshold', () => {
      const w0 = 1.0;
      const lambda = 0.01;
      const t0 = 0;
      const tCurrent = 10;
      const threshold = 0.01;

      const result = isMemoryAlive(w0, lambda, t0, tCurrent, threshold);
      expect(result).toBe(true);
    });

    it('should return false when weight decays below threshold', () => {
      const w0 = 1.0;
      const lambda = 0.1;
      const t0 = 0;
      const tCurrent = 100;
      const threshold = 0.01;

      const result = isMemoryAlive(w0, lambda, t0, tCurrent, threshold);
      expect(result).toBe(false);
    });
  });

  describe('shouldCrystallize', () => {
    it('should return true when access count exceeds threshold', () => {
      const accessCount = 15;
      const ageMs = 100000;
      const threshold = 10;

      const result = shouldCrystallize(accessCount, ageMs, threshold);
      expect(result).toBe(true);
    });

    it('should return false when access count is below threshold', () => {
      const accessCount = 5;
      const ageMs = 100000;
      const threshold = 10;

      const result = shouldCrystallize(accessCount, ageMs, threshold);
      expect(result).toBe(false);
    });
  });

  describe('DEFAULT_DECAY_CONFIG', () => {
    it('should have L3 lambda set to 0 (immutable)', () => {
      expect(DEFAULT_DECAY_CONFIG.defaultLambda.L3).toBe(0);
    });

    it('should have L1 lambda higher than L2 (faster decay)', () => {
      expect(DEFAULT_DECAY_CONFIG.defaultLambda.L1).toBeGreaterThan(
        DEFAULT_DECAY_CONFIG.defaultLambda.L2
      );
    });
  });
});
