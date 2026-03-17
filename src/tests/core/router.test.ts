/**
 * Tests: Tier Router (MoE)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMTS,
  determineTierFromMTS,
  routeMemoryUnit,
  DEFAULT_MTS_WEIGHTS,
  DEFAULT_TIER_THRESHOLDS
} from '../../core/tiers/router';
import {
  createSampleUnit,
  createHighSensitivityUnit,
  createLowPriorityUnit
} from '../fixtures/memory-units';

describe('Tier Router', () => {
  describe('calculateMTS', () => {
    it('should calculate MTS within [0, 1] range', () => {
      const factors = {
        sensitivity: 0.5,
        accuracy: 0.5,
        privilege: 0.5,
        computeConstraint: 0.3
      };

      const mts = calculateMTS(factors);
      expect(mts).toBeGreaterThanOrEqual(0);
      expect(mts).toBeLessThanOrEqual(1);
    });

    it('should return high MTS for sensitive content', () => {
      const factors = {
        sensitivity: 1.0,
        accuracy: 1.0,
        privilege: 1.0,
        computeConstraint: 0.0
      };

      const mts = calculateMTS(factors);
      expect(mts).toBeGreaterThanOrEqual(0.8);
    });

    it('should return low MTS when compute constrained', () => {
      const factors = {
        sensitivity: 0.3,
        accuracy: 0.3,
        privilege: 0.3,
        computeConstraint: 0.9
      };

      const mts = calculateMTS(factors);
      expect(mts).toBeLessThan(0.3);
    });
  });

  describe('determineTierFromMTS', () => {
    it('should route high MTS to L3', () => {
      const tier = determineTierFromMTS(0.9);
      expect(tier).toBe('L3');
    });

    it('should route medium MTS to L2', () => {
      const tier = determineTierFromMTS(0.5);
      expect(tier).toBe('L2');
    });

    it('should route low MTS to L1', () => {
      const tier = determineTierFromMTS(0.1);
      expect(tier).toBe('L1');
    });

    it('should use custom thresholds', () => {
      const customThresholds = { l3: 0.9, l2: 0.5 };
      const tier = determineTierFromMTS(0.6, customThresholds);
      expect(tier).toBe('L2');
    });
  });

  describe('routeMemoryUnit', () => {
    it('should route standard unit to appropriate tier', () => {
      const unit = createSampleUnit(0);
      const decision = routeMemoryUnit(unit);

      expect(decision.tier).toBeDefined();
      expect(decision.mtsScore).toBeGreaterThanOrEqual(0);
      expect(decision.mtsScore).toBeLessThanOrEqual(1);
      expect(decision.reasoning).toContain('Routed to');
    });

    it('should provide confidence score', () => {
      const unit = createSampleUnit(0);
      const decision = routeMemoryUnit(unit);

      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should route high-sensitivity unit toward L3', () => {
      const unit = createHighSensitivityUnit();
      const decision = routeMemoryUnit(unit);

      // High sensitivity should increase MTS
      expect(decision.mtsScore).toBeGreaterThan(0.5);
    });

    it('should route low-priority unit toward L1', () => {
      const unit = createLowPriorityUnit();
      const decision = routeMemoryUnit(unit);

      // Ephemeral content should have lower MTS
      expect(decision.mtsScore).toBeLessThan(0.5);
    });
  });

  describe('DEFAULT_MTS_WEIGHTS', () => {
    it('should have weights that sum close to 1', () => {
      const sum =
        DEFAULT_MTS_WEIGHTS.sensitivity +
        DEFAULT_MTS_WEIGHTS.accuracy +
        DEFAULT_MTS_WEIGHTS.privilege +
        DEFAULT_MTS_WEIGHTS.compute;

      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });
  });

  describe('DEFAULT_TIER_THRESHOLDS', () => {
    it('should have L3 threshold higher than L2', () => {
      expect(DEFAULT_TIER_THRESHOLDS.l3).toBeGreaterThan(DEFAULT_TIER_THRESHOLDS.l2);
    });
  });
});
