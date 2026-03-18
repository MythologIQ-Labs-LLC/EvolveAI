/**
 * Storage Module
 * Pluggable persistence layer
 */

// Types
export type { StorageAdapter, StorageConfig } from './types';
export { DEFAULT_STORAGE_CONFIG } from './types';

// Memory adapter
export { MemoryAdapter, createMemoryAdapter } from './memory';
