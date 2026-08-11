/**
 * Storage Module
 * Pluggable persistence layer
 */

// Types
export type { StorageAdapter, StorageConfig } from './types.js';
export { DEFAULT_STORAGE_CONFIG } from './types.js';

// Memory adapter
export { MemoryAdapter, createMemoryAdapter } from './memory.js';
