/**
 * Test Fixtures: Memory Units
 */

import type { MemoryUnit, RawInput } from '../../core/memory/types';

/**
 * Create a mock embedding
 */
export function createMockEmbedding(seed: number = 0, dimensions: number = 384): Float32Array {
  const embedding = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    embedding[i] = Math.sin(seed * (i + 1)) * 0.5;
  }
  return embedding;
}

/**
 * Sample raw inputs
 */
export const SAMPLE_INPUTS: RawInput[] = [
  {
    content: 'The quick brown fox jumps over the lazy dog',
    metadata: { type: 'text', source: 'test' }
  },
  {
    content: { key: 'value', nested: { data: 123 } },
    metadata: { type: 'object', source: 'test' }
  },
  {
    content: 'Sensitive personal information',
    metadata: { type: 'text', source: 'test', tags: ['sensitive', 'personal'] }
  },
  {
    content: 'Core foundational knowledge',
    metadata: { type: 'text', source: 'test', tags: ['core', 'foundational'] }
  },
  {
    content: 'Ephemeral temporary note',
    metadata: { type: 'text', source: 'test', tags: ['ephemeral', 'temporary'] }
  }
];

/**
 * Create a sample memory unit
 */
export function createSampleUnit(
  index: number = 0,
  overrides: Partial<MemoryUnit> = {}
): MemoryUnit {
  const input = SAMPLE_INPUTS[index % SAMPLE_INPUTS.length];
  const embedding = createMockEmbedding(index);

  return {
    uor_id: `test_unit_${index}_${Date.now()}`,
    content: input.content,
    embedding,
    metadata: {
      tier: 'L2',
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      ...input.metadata,
      ...overrides.metadata
    },
    ...overrides
  };
}

/**
 * Create multiple sample units
 */
export function createSampleUnits(count: number): MemoryUnit[] {
  return Array.from({ length: count }, (_, i) => createSampleUnit(i));
}

/**
 * Create a high-sensitivity unit (should route to L3)
 */
export function createHighSensitivityUnit(): MemoryUnit {
  return createSampleUnit(2, {
    metadata: {
      tier: 'L3',
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      tags: ['sensitive', 'personal', 'fact']
    }
  });
}

/**
 * Create a low-priority unit (should route to L1)
 */
export function createLowPriorityUnit(): MemoryUnit {
  return createSampleUnit(4, {
    metadata: {
      tier: 'L1',
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      tags: ['ephemeral', 'temporary']
    }
  });
}
