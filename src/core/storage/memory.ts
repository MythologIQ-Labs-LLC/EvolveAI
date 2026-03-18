/**
 * Memory Storage Adapter
 * In-memory implementation for testing and development
 */

import type { StorageAdapter } from './types';

/**
 * In-memory storage adapter
 * Uses Map internally, provides async interface for consistency
 */
export class MemoryAdapter<T> implements StorageAdapter<T> {
  private data: Map<string, T> = new Map();

  async get(key: string): Promise<T | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  async *keys(): AsyncIterable<string> {
    for (const key of this.data.keys()) {
      yield key;
    }
  }

  async *values(): AsyncIterable<T> {
    for (const value of this.data.values()) {
      yield value;
    }
  }

  async *entries(): AsyncIterable<[string, T]> {
    for (const entry of this.data.entries()) {
      yield entry;
    }
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async close(): Promise<void> {
    // No-op for memory adapter
  }

  async getBatch(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const value = this.data.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    return result;
  }

  async setBatch(entries: Array<[string, T]>): Promise<void> {
    for (const [key, value] of entries) {
      this.data.set(key, value);
    }
  }

  async size(): Promise<number> {
    return this.data.size;
  }
}

/**
 * Create memory adapter instance
 */
export function createMemoryAdapter<T>(): MemoryAdapter<T> {
  return new MemoryAdapter<T>();
}
