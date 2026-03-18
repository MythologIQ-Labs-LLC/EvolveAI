/**
 * Shadow Genome Bootstrap Tests
 * TDD-Light: Verify bootstrap patterns are ingested correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEngine } from '../../core/representation';
import type { RepresentationEngine } from '../../core/representation/engine';
import { createShadowGenome, type ShadowGenome } from '../../core/shadow/genome';
import {
  bootstrapGenome,
  BOOTSTRAP_PATTERNS,
  getBootstrapPatternCount,
  getPatternsByCategory
} from '../../core/shadow/bootstrap';

describe('Shadow Genome Bootstrap', () => {
  let engine: RepresentationEngine;
  let genome: ShadowGenome;

  beforeEach(() => {
    engine = createMockEngine();
    genome = createShadowGenome();
  });

  it('bootstrap adds all canonical patterns', async () => {
    const added = await bootstrapGenome(genome, engine);

    expect(added).toBe(BOOTSTRAP_PATTERNS.length);

    const stats = genome.getStats();
    expect(stats.totalEntries).toBe(BOOTSTRAP_PATTERNS.length);
    expect(stats.activeEntries).toBe(BOOTSTRAP_PATTERNS.length);
  });

  it('double-bootstrap is idempotent (no duplicates)', async () => {
    await bootstrapGenome(genome, engine);
    const secondAdd = await bootstrapGenome(genome, engine);

    expect(secondAdd).toBe(0);

    const stats = genome.getStats();
    expect(stats.totalEntries).toBe(BOOTSTRAP_PATTERNS.length);
  });

  it('bootstrapped genome contains complexity violation patterns', async () => {
    await bootstrapGenome(genome, engine);

    const entries = genome.getEntriesByType('COMPLEXITY_VIOLATION');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('bootstrapped genome contains security regression patterns', async () => {
    await bootstrapGenome(genome, engine);

    const entries = genome.getEntriesByType('SECURITY_REGRESSION');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('bootstrapped genome contains hallucination patterns', async () => {
    await bootstrapGenome(genome, engine);

    const entries = genome.getEntriesByType('HALLUCINATION');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('bootstrapped entries have correct structure', async () => {
    await bootstrapGenome(genome, engine);

    const entries = genome.getEntries();
    for (const entry of entries) {
      expect(entry.id).toBeDefined();
      expect(entry.embedding).toBeInstanceOf(Float32Array);
      expect(entry.failureType).toBeDefined();
      expect(entry.originalTrace).toBeDefined();
      expect(entry.originalTrace.intent).toBeDefined();
      expect(entry.originalTrace.message).toBeDefined();
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.triggerCount).toBe(1);
      expect(entry.active).toBe(true);
    }
  });

  it('getBootstrapPatternCount returns correct count', () => {
    const count = getBootstrapPatternCount();
    expect(count).toBe(BOOTSTRAP_PATTERNS.length);
  });

  it('getPatternsByCategory filters correctly', () => {
    const complexityPatterns = getPatternsByCategory('COMPLEXITY_VIOLATION');
    const securityPatterns = getPatternsByCategory('SECURITY_REGRESSION');

    expect(complexityPatterns.length).toBeGreaterThan(0);
    expect(securityPatterns.length).toBeGreaterThan(0);

    complexityPatterns.forEach(p => {
      expect(p.category).toBe('COMPLEXITY_VIOLATION');
    });

    securityPatterns.forEach(p => {
      expect(p.category).toBe('SECURITY_REGRESSION');
    });
  });

  it('bootstrap entries have source=bootstrap in context', async () => {
    await bootstrapGenome(genome, engine);

    const entries = genome.getEntries();
    for (const entry of entries) {
      expect(entry.originalTrace.context.source).toBe('bootstrap');
    }
  });
});
