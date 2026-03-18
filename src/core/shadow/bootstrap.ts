/**
 * Shadow Genome Bootstrap
 * Pre-populate genome with canonical failure patterns
 */

import type { RepresentationEngine } from '../representation/engine';
import type { FailureCategory, FailureTrace } from './failure-types';
import type { ShadowGenome } from './genome';
import { createFailureTrace } from './failure-types';

/**
 * Bootstrap pattern definition
 */
export interface BootstrapPattern {
  category: FailureCategory;
  intent: string;
  message: string;
}

/**
 * Canonical failure patterns for bootstrap
 */
export const BOOTSTRAP_PATTERNS: BootstrapPattern[] = [
  // Complexity violations
  {
    category: 'COMPLEXITY_VIOLATION',
    intent: 'Add abstraction layer for single use case',
    message: 'Premature abstraction adds complexity without benefit'
  },
  {
    category: 'COMPLEXITY_VIOLATION',
    intent: 'Create factory for class instantiated once',
    message: 'Over-engineering simple construction'
  },
  {
    category: 'COMPLEXITY_VIOLATION',
    intent: 'Add configuration for hardcoded value',
    message: 'Unnecessary configurability increases complexity'
  },

  // Premature optimization
  {
    category: 'PREMATURE_OPTIMIZATION',
    intent: 'Optimize code path without profiling data',
    message: 'Optimization without measurement is speculation'
  },
  {
    category: 'PREMATURE_OPTIMIZATION',
    intent: 'Add caching before identifying bottleneck',
    message: 'Premature caching adds complexity and potential bugs'
  },

  // Hallucination
  {
    category: 'HALLUCINATION',
    intent: 'Claim capability without verification',
    message: 'Unverified claims lead to runtime failures'
  },
  {
    category: 'HALLUCINATION',
    intent: 'Assert API exists without checking documentation',
    message: 'Assumed APIs may not exist or behave differently'
  },

  // Scope creep
  {
    category: 'SCOPE_CREEP',
    intent: 'Add unrequested feature during implementation',
    message: 'Scope creep derails project timelines'
  },
  {
    category: 'SCOPE_CREEP',
    intent: 'Refactor surrounding code while fixing bug',
    message: 'Unrelated changes increase risk and review burden'
  },

  // Security regression
  {
    category: 'SECURITY_REGRESSION',
    intent: 'Disable security check for convenience',
    message: 'Security shortcuts create vulnerabilities'
  },
  {
    category: 'SECURITY_REGRESSION',
    intent: 'Log sensitive data for debugging',
    message: 'Debug logging can expose credentials'
  },

  // Technical debt
  {
    category: 'TECHNICAL_DEBT',
    intent: 'Skip tests to meet deadline',
    message: 'Missing tests compound future maintenance cost'
  },
  {
    category: 'TECHNICAL_DEBT',
    intent: 'Copy-paste code instead of extracting function',
    message: 'Duplication multiplies future bug fixes'
  }
];

/**
 * Bootstrap genome with canonical failure patterns
 * Returns count of patterns added
 */
export async function bootstrapGenome(
  genome: ShadowGenome,
  engine: RepresentationEngine
): Promise<number> {
  let added = 0;

  for (const pattern of BOOTSTRAP_PATTERNS) {
    const trace: FailureTrace = createFailureTrace(
      pattern.category,
      pattern.intent,
      pattern.message,
      { source: 'bootstrap' }
    );

    // Encode intent for similarity matching
    const rep = await engine.encode(pattern.intent);

    // Extract embedding from representation
    const embedding = extractEmbedding(rep);

    // Check if already exists
    const existing = genome.getEntries().find(
      e => e.originalTrace.intent === pattern.intent
    );

    if (!existing) {
      await genome.ingest(trace, embedding);
      added++;
    }
  }

  return added;
}

/**
 * Extract Float32Array from representation
 * Uses internal bytes structure
 */
function extractEmbedding(rep: { bytes: Uint8Array }): Float32Array {
  // Read header length (first 4 bytes, big-endian)
  const headerLength = new DataView(
    rep.bytes.buffer,
    rep.bytes.byteOffset
  ).getUint32(0, false);

  // Payload starts after header
  const payloadOffset = 4 + headerLength;
  const payloadBytes = rep.bytes.slice(payloadOffset);

  return new Float32Array(
    payloadBytes.buffer,
    payloadBytes.byteOffset,
    payloadBytes.length / 4
  );
}

/**
 * Get bootstrap pattern count
 */
export function getBootstrapPatternCount(): number {
  return BOOTSTRAP_PATTERNS.length;
}

/**
 * Get patterns by category
 */
export function getPatternsByCategory(
  category: FailureCategory
): BootstrapPattern[] {
  return BOOTSTRAP_PATTERNS.filter(p => p.category === category);
}
