/**
 * Storage Adapter Types
 * Pluggable persistence layer abstraction
 */

/**
 * Generic storage adapter interface
 * Implementations: MemoryAdapter (tests), SQLiteAdapter (production)
 */
export interface StorageAdapter<T> {
  /** Get value by key */
  get(key: string): Promise<T | null>;

  /** Set value by key */
  set(key: string, value: T): Promise<void>;

  /** Delete value by key */
  delete(key: string): Promise<boolean>;

  /** Check if key exists */
  has(key: string): Promise<boolean>;

  /** Iterate over all keys */
  keys(): AsyncIterable<string>;

  /** Iterate over all values */
  values(): AsyncIterable<T>;

  /** Iterate over all entries */
  entries(): AsyncIterable<[string, T]>;

  /** Clear all data */
  clear(): Promise<void>;

  /** Close connection (cleanup) */
  close(): Promise<void>;

  /** Batch get for efficiency */
  getBatch(keys: string[]): Promise<Map<string, T>>;

  /** Batch set for efficiency */
  setBatch(entries: Array<[string, T]>): Promise<void>;

  /** Get current size */
  size(): Promise<number>;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Storage type */
  type: 'memory' | 'sqlite';
  /** Database file path (for SQLite) */
  path?: string;
  /** Table name (for SQLite, enables multi-collection) */
  tableName?: string;
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  type: 'memory'
};
