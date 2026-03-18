/**
 * Reference Patterns
 * Pattern definitions for semantic MTS assessment
 */

import type { RepresentationEngine } from '../representation/engine';
import type { Representation } from '../representation/types';

/**
 * Raw text patterns for each assessment dimension
 * Encoded at runtime via RepresentationEngine
 */
export const SENSITIVITY_PATTERNS = {
  high: [
    'password',
    'secret key',
    'SSN',
    'credit card number',
    'private key',
    'API token',
    'authentication credential'
  ],
  low: [
    'weather today',
    'hello world',
    'meeting notes',
    'grocery list',
    'general information'
  ]
};

export const ACCURACY_PATTERNS = {
  high: [
    'the definition of',
    'the formula is',
    'according to the specification',
    'the exact value',
    'must be precisely'
  ],
  low: [
    'I think',
    'maybe',
    'probably',
    'it seems like',
    'roughly',
    'approximately',
    'in my opinion'
  ]
};

export const PRIVILEGE_PATTERNS = {
  high: [
    'system configuration',
    'admin access',
    'root privilege',
    'database connection',
    'encryption key'
  ],
  low: [
    'user preference',
    'display setting',
    'theme color',
    'notification option',
    'language choice'
  ]
};

/**
 * Encoded reference patterns structure
 */
export interface ReferencePatterns {
  sensitivity: {
    high: Representation[];
    low: Representation[];
  };
  accuracy: {
    high: Representation[];
    low: Representation[];
  };
  privilege: {
    high: Representation[];
    low: Representation[];
  };
}

/**
 * Encode all reference patterns using engine
 * Called once at startup, cached
 */
export async function encodeReferencePatterns(
  engine: RepresentationEngine
): Promise<ReferencePatterns> {
  const [
    sensitivityHigh,
    sensitivityLow,
    accuracyHigh,
    accuracyLow,
    privilegeHigh,
    privilegeLow
  ] = await Promise.all([
    engine.encodeBatch(SENSITIVITY_PATTERNS.high),
    engine.encodeBatch(SENSITIVITY_PATTERNS.low),
    engine.encodeBatch(ACCURACY_PATTERNS.high),
    engine.encodeBatch(ACCURACY_PATTERNS.low),
    engine.encodeBatch(PRIVILEGE_PATTERNS.high),
    engine.encodeBatch(PRIVILEGE_PATTERNS.low)
  ]);

  return {
    sensitivity: { high: sensitivityHigh, low: sensitivityLow },
    accuracy: { high: accuracyHigh, low: accuracyLow },
    privilege: { high: privilegeHigh, low: privilegeLow }
  };
}
