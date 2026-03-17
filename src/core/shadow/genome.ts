/**
 * Shadow Genome Store
 * Negative-constraint immune system tracking failure patterns
 */

import type { FailureTrace, FailureCategory } from './failure-types';
import { now } from '../../lib/utils/time';
import { sha256 } from '../../lib/utils/hash';

/**
 * A stored shadow entry (vectorized failure pattern)
 */
export interface ShadowEntry {
  /** Unique entry ID */
  id: string;
  /** Semantic embedding of the failure intent */
  embedding: Float32Array;
  /** Category of failure */
  failureType: FailureCategory;
  /** Original failure trace */
  originalTrace: FailureTrace;
  /** When this entry was created */
  createdAt: number;
  /** Number of times this pattern triggered a block */
  triggerCount: number;
  /** Whether this entry is active */
  active: boolean;
}

/**
 * Shadow Genome configuration
 */
export interface ShadowGenomeConfig {
  /** Maximum entries to store */
  maxEntries: number;
  /** Minimum trigger count before auto-pruning */
  minTriggerForRetention: number;
  /** Age threshold for pruning inactive entries (ms) */
  pruneAgeMs: number;
}

export const DEFAULT_SHADOW_CONFIG: ShadowGenomeConfig = {
  maxEntries: 1000,
  minTriggerForRetention: 2,
  pruneAgeMs: 2592000000 // 30 days
};

/**
 * Shadow Genome Store implementation
 */
export class ShadowGenome {
  private entries: Map<string, ShadowEntry> = new Map();
  private config: ShadowGenomeConfig;

  constructor(config: ShadowGenomeConfig = DEFAULT_SHADOW_CONFIG) {
    this.config = config;
  }

  /**
   * Generate entry ID from failure trace
   */
  private generateId(trace: FailureTrace): string {
    const input = `${trace.category}:${trace.intent}:${trace.message}`;
    return sha256(input).slice(0, 16);
  }

  /**
   * Ingest a failure trace into the genome
   */
  async ingest(
    trace: FailureTrace,
    embedding: Float32Array
  ): Promise<ShadowEntry> {
    const id = this.generateId(trace);

    // Check for existing entry
    const existing = this.entries.get(id);
    if (existing) {
      // Update existing entry
      const updated: ShadowEntry = {
        ...existing,
        triggerCount: existing.triggerCount + 1
      };
      this.entries.set(id, updated);
      return updated;
    }

    // Prune if at capacity
    if (this.entries.size >= this.config.maxEntries) {
      this.pruneOldest();
    }

    // Create new entry
    const entry: ShadowEntry = {
      id,
      embedding,
      failureType: trace.category,
      originalTrace: trace,
      createdAt: now(),
      triggerCount: 1,
      active: true
    };

    this.entries.set(id, entry);
    return entry;
  }

  /**
   * Get all active entries
   */
  getEntries(): ShadowEntry[] {
    return Array.from(this.entries.values()).filter(e => e.active);
  }

  /**
   * Get entries by failure type
   */
  getEntriesByType(type: FailureCategory): ShadowEntry[] {
    return this.getEntries().filter(e => e.failureType === type);
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): ShadowEntry | null {
    return this.entries.get(id) ?? null;
  }

  /**
   * Increment trigger count for an entry
   */
  recordTrigger(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      this.entries.set(id, {
        ...entry,
        triggerCount: entry.triggerCount + 1
      });
    }
  }

  /**
   * Deactivate an entry (soft delete)
   */
  deactivate(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    this.entries.set(id, { ...entry, active: false });
    return true;
  }

  /**
   * Reactivate a deactivated entry
   */
  reactivate(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    this.entries.set(id, { ...entry, active: true });
    return true;
  }

  /**
   * Prune oldest/least triggered entries
   */
  private pruneOldest(): void {
    const currentTime = now();
    const candidates: Array<[string, ShadowEntry]> = [];

    for (const [id, entry] of this.entries.entries()) {
      const age = currentTime - entry.createdAt;

      // Skip entries with high trigger counts
      if (entry.triggerCount >= this.config.minTriggerForRetention) {
        continue;
      }

      // Candidate for pruning if old enough
      if (age >= this.config.pruneAgeMs) {
        candidates.push([id, entry]);
      }
    }

    // Sort by trigger count (ascending) then age (descending)
    candidates.sort((a, b) => {
      if (a[1].triggerCount !== b[1].triggerCount) {
        return a[1].triggerCount - b[1].triggerCount;
      }
      return b[1].createdAt - a[1].createdAt;
    });

    // Remove least valuable entry
    if (candidates.length > 0) {
      this.entries.delete(candidates[0][0]);
    }
  }

  /**
   * Run full pruning pass
   */
  prune(): number {
    const currentTime = now();
    let pruned = 0;

    for (const [id, entry] of this.entries.entries()) {
      const age = currentTime - entry.createdAt;

      // Prune inactive old entries with low triggers
      if (!entry.active &&
          age >= this.config.pruneAgeMs &&
          entry.triggerCount < this.config.minTriggerForRetention) {
        this.entries.delete(id);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get genome statistics
   */
  getStats(): {
    totalEntries: number;
    activeEntries: number;
    byCategory: Record<string, number>;
    totalTriggers: number;
  } {
    const entries = Array.from(this.entries.values());
    const byCategory: Record<string, number> = {};
    let totalTriggers = 0;

    for (const entry of entries) {
      byCategory[entry.failureType] = (byCategory[entry.failureType] ?? 0) + 1;
      totalTriggers += entry.triggerCount;
    }

    return {
      totalEntries: entries.length,
      activeEntries: entries.filter(e => e.active).length,
      byCategory,
      totalTriggers
    };
  }

  /**
   * Export genome for persistence
   */
  export(): ShadowEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Import genome from persistence
   */
  import(entries: ShadowEntry[]): void {
    this.entries.clear();
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }
}

/**
 * Create a new shadow genome instance
 */
export function createShadowGenome(config?: ShadowGenomeConfig): ShadowGenome {
  return new ShadowGenome(config);
}
