/**
 * Shadow Genome Interceptor
 * Semantic Pause safety check during lifecycle Phase 2
 */

import type { ShadowEntry, ShadowGenome } from './genome';
import type { FailureCategory } from './failure-types';
import { cosineSimilarity } from '../memory/decoder';

/**
 * Intent payload for safety checking
 */
export interface IntentPayload {
  /** Textual intent description */
  intent: string;
  /** Semantic embedding of intent */
  embedding: Float32Array;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Safety verdict from interceptor
 */
export interface SafetyVerdict {
  /** PASS allows execution, BLOCK halts */
  verdict: 'PASS' | 'BLOCK';
  /** Matching shadow entries that triggered consideration */
  matchedConstraints: ShadowEntry[];
  /** Highest similarity score encountered */
  highestSimilarity: number;
  /** Human-readable reasoning */
  reasoning: string;
}

/**
 * Interceptor configuration
 */
export interface InterceptorConfig {
  /** Cosine similarity threshold for blocking (0-1) */
  safetyThreshold: number;
  /** Maximum matches to return in verdict */
  maxMatchesToReturn: number;
  /** Block on first match above threshold */
  blockOnFirstMatch: boolean;
  /** Categories that always block regardless of similarity */
  criticalCategories: FailureCategory[];
}

export const DEFAULT_INTERCEPTOR_CONFIG: InterceptorConfig = {
  safetyThreshold: 0.85,
  maxMatchesToReturn: 5,
  blockOnFirstMatch: false,
  criticalCategories: ['SECURITY_REGRESSION', 'HALLUCINATION']
};

/**
 * Shadow Genome Interceptor implementation
 */
export class ShadowInterceptor {
  private genome: ShadowGenome;
  private config: InterceptorConfig;

  constructor(genome: ShadowGenome, config: InterceptorConfig = DEFAULT_INTERCEPTOR_CONFIG) {
    this.genome = genome;
    this.config = config;
  }

  /**
   * Check an intent against shadow genome
   */
  check(payload: IntentPayload): SafetyVerdict {
    const entries = this.genome.getEntries();
    const matches: Array<{ entry: ShadowEntry; similarity: number }> = [];

    for (const entry of entries) {
      const similarity = cosineSimilarity(payload.embedding, entry.embedding);

      // Check if above threshold
      if (similarity >= this.config.safetyThreshold) {
        matches.push({ entry, similarity });

        // Record trigger
        this.genome.recordTrigger(entry.id);

        // Early exit if configured
        if (this.config.blockOnFirstMatch) {
          return this.createBlockVerdict(
            [entry],
            similarity,
            `Blocked by shadow constraint: ${entry.failureType}`
          );
        }
      }

      // Also check critical categories with lower threshold
      if (this.config.criticalCategories.includes(entry.failureType) &&
          similarity >= this.config.safetyThreshold * 0.7) {
        matches.push({ entry, similarity });
        this.genome.recordTrigger(entry.id);
      }
    }

    // No matches - pass
    if (matches.length === 0) {
      return {
        verdict: 'PASS',
        matchedConstraints: [],
        highestSimilarity: 0,
        reasoning: 'No shadow constraints matched'
      };
    }

    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity);

    const highestSimilarity = matches[0].similarity;
    const topMatches = matches
      .slice(0, this.config.maxMatchesToReturn)
      .map(m => m.entry);

    // Determine verdict based on matches
    const hasCritical = topMatches.some(
      e => this.config.criticalCategories.includes(e.failureType)
    );

    if (hasCritical || highestSimilarity >= this.config.safetyThreshold) {
      const categories = [...new Set(topMatches.map(e => e.failureType))];
      return this.createBlockVerdict(
        topMatches,
        highestSimilarity,
        `Blocked: matches ${categories.join(', ')} patterns`
      );
    }

    // Soft match - pass with warning
    return {
      verdict: 'PASS',
      matchedConstraints: topMatches,
      highestSimilarity,
      reasoning: `Passed with ${matches.length} soft matches (below threshold)`
    };
  }

  /**
   * Create a blocking verdict
   */
  private createBlockVerdict(
    constraints: ShadowEntry[],
    similarity: number,
    reasoning: string
  ): SafetyVerdict {
    return {
      verdict: 'BLOCK',
      matchedConstraints: constraints,
      highestSimilarity: similarity,
      reasoning
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<InterceptorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current threshold
   */
  getThreshold(): number {
    return this.config.safetyThreshold;
  }

  /**
   * Set safety threshold
   */
  setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    this.config.safetyThreshold = threshold;
  }

  /**
   * Add a critical category
   */
  addCriticalCategory(category: FailureCategory): void {
    if (!this.config.criticalCategories.includes(category)) {
      this.config.criticalCategories.push(category);
    }
  }

  /**
   * Remove a critical category
   */
  removeCriticalCategory(category: FailureCategory): void {
    this.config.criticalCategories = this.config.criticalCategories.filter(
      c => c !== category
    );
  }

  /**
   * Get interceptor stats
   */
  getStats(): {
    genomeSize: number;
    threshold: number;
    criticalCategories: FailureCategory[];
  } {
    const genomeStats = this.genome.getStats();
    return {
      genomeSize: genomeStats.activeEntries,
      threshold: this.config.safetyThreshold,
      criticalCategories: [...this.config.criticalCategories]
    };
  }
}

/**
 * Create a new interceptor instance
 */
export function createInterceptor(
  genome: ShadowGenome,
  config?: InterceptorConfig
): ShadowInterceptor {
  return new ShadowInterceptor(genome, config);
}
