/**
 * Test Fixtures: Queries
 */

import type { Query } from '../../core/memory/types';
import { createMockEmbedding } from './memory-units';

/**
 * Sample queries
 */
export const SAMPLE_QUERIES: Query[] = [
  {
    content: 'Find information about foxes',
    embedding: createMockEmbedding(100),
    context: { intent: 'search' }
  },
  {
    content: 'Retrieve personal data',
    embedding: createMockEmbedding(101),
    context: { intent: 'recall', sensitive: true }
  },
  {
    content: 'Get core knowledge',
    embedding: createMockEmbedding(102),
    context: { intent: 'lookup' }
  }
];

/**
 * Create a sample query
 */
export function createSampleQuery(
  index: number = 0,
  overrides: Partial<Query> = {}
): Query {
  const base = SAMPLE_QUERIES[index % SAMPLE_QUERIES.length];
  return {
    ...base,
    ...overrides,
    embedding: overrides.embedding ?? createMockEmbedding(100 + index)
  };
}

/**
 * Create a semantic search query
 */
export function createSemanticQuery(text: string, seed: number = 200): Query {
  return {
    content: text,
    embedding: createMockEmbedding(seed),
    context: { intent: 'semantic_search' }
  };
}

/**
 * Create an exact match query
 */
export function createExactMatchQuery(uorId: string): Query {
  return {
    content: uorId,
    embedding: createMockEmbedding(300),
    context: { intent: 'exact_match', uorId }
  };
}

/**
 * Create a relational query
 */
export function createRelationalQuery(
  startNodeId: string,
  depth: number = 2
): Query {
  return {
    content: `Traverse from ${startNodeId}`,
    embedding: createMockEmbedding(400),
    context: {
      intent: 'relational',
      startNodeId,
      traversalDepth: depth
    }
  };
}
