/**
 * L1 Transient Cache
 * Fast vector-based memory with TTL eviction
 */

import type { MemoryUnit, Tier } from '../memory/types';
import { now } from '../../lib/utils/time';
import { cosineSimilarity } from '../memory/decoder';

/**
 * L1 Cache configuration
 */
export interface L1CacheConfig {
  /** Maximum entries in cache */
  maxSize: number;
  /** Default TTL in milliseconds */
  defaultTtlMs: number;
  /** Eviction check interval */
  evictionIntervalMs: number;
}

/**
 * Cached entry with TTL
 */
interface CachedEntry {
  unit: MemoryUnit;
  expiresAt: number;
  insertedAt: number;
}

export const DEFAULT_L1_CONFIG: L1CacheConfig = {
  maxSize: 1000,
  defaultTtlMs: 3600000, // 1 hour
  evictionIntervalMs: 60000 // 1 minute
};

/**
 * L1 Transient Cache implementation
 */
export class L1Cache {
  private cache: Map<string, CachedEntry> = new Map();
  private config: L1CacheConfig;
  private evictionTimer?: ReturnType<typeof setInterval>;

  constructor(config: L1CacheConfig = DEFAULT_L1_CONFIG) {
    this.config = config;
  }

  /**
   * Start automatic eviction timer
   */
  startEviction(): void {
    if (this.evictionTimer) return;
    this.evictionTimer = setInterval(
      () => this.evictExpired(),
      this.config.evictionIntervalMs
    );
  }

  /**
   * Stop automatic eviction timer
   */
  stopEviction(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = undefined;
    }
  }

  /**
   * Insert a memory unit into cache
   */
  insert(unit: MemoryUnit, ttlMs?: number): void {
    const ttl = ttlMs ?? this.config.defaultTtlMs;
    const timestamp = now();

    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(unit.uor_id, {
      unit,
      insertedAt: timestamp,
      expiresAt: timestamp + ttl
    });
  }

  /**
   * Retrieve a unit by UOR ID
   */
  get(uorId: string): MemoryUnit | null {
    const entry = this.cache.get(uorId);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt < now()) {
      this.cache.delete(uorId);
      return null;
    }

    return entry.unit;
  }

  /**
   * Find top-K similar units by embedding
   */
  topK(queryEmbedding: Float32Array, k: number): MemoryUnit[] {
    const currentTime = now();
    const scored: Array<{ unit: MemoryUnit; score: number }> = [];

    for (const entry of this.cache.values()) {
      if (entry.expiresAt < currentTime) continue;

      const score = cosineSimilarity(queryEmbedding, entry.unit.embedding);
      scored.push({ unit: entry.unit, score });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => s.unit);
  }

  /**
   * Remove a specific entry
   */
  remove(uorId: string): boolean {
    return this.cache.delete(uorId);
  }

  /**
   * Evict all expired entries
   */
  evictExpired(): number {
    const currentTime = now();
    let evicted = 0;

    for (const [id, entry] of this.cache.entries()) {
      if (entry.expiresAt < currentTime) {
        this.cache.delete(id);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Evict oldest entry (LRU-style)
   */
  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.cache.entries()) {
      if (entry.insertedAt < oldestTime) {
        oldest = id;
        oldestTime = entry.insertedAt;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if UOR ID exists in cache
   */
  has(uorId: string): boolean {
    const entry = this.cache.get(uorId);
    if (!entry) return false;
    if (entry.expiresAt < now()) {
      this.cache.delete(uorId);
      return false;
    }
    return true;
  }
}

/**
 * Create a new L1 cache instance
 */
export function createL1Cache(config?: L1CacheConfig): L1Cache {
  return new L1Cache(config);
}
