/**
 * Hash Chain Type Definitions
 * L3 UOR Vault cryptographic structures
 */

/**
 * Memory operations that can be recorded in the chain
 */
export type MemoryOperation = 'CRYSTALLIZE' | 'DEPRECATE' | 'GENESIS';

/**
 * Block metadata for audit and tracing
 */
export interface BlockMetadata {
  /** Source phase that triggered this operation */
  sourcePhase: string;
  /** Optional trace ID for linking to pipeline traces */
  traceId?: string;
  /** Additional context for the operation */
  context?: Record<string, unknown>;
}

/**
 * A single block in the hash chain
 */
export interface Block {
  /** Sequential block index */
  index: number;
  /** Unix timestamp of block creation */
  timestamp: number;
  /** UOR identifier of the memory content */
  uorId: string;
  /** SHA256 hash of the content */
  contentHash: string;
  /** Hash of the previous block (or GENESIS for first) */
  previousHash: string;
  /** The operation being recorded */
  operation: MemoryOperation;
  /** Additional metadata */
  metadata: BlockMetadata;
  /** Hash of this entire block */
  blockHash: string;
}

/**
 * Immutable memory stored in L3 vault
 */
export interface ImmutableMemory {
  /** UOR identifier */
  uorId: string;
  /** Original content */
  content: unknown;
  /** Content hash for verification */
  contentHash: string;
  /** Block index where crystallized */
  blockIndex: number;
  /** Timestamp of crystallization */
  crystallizedAt: number;
}

/**
 * Result of chain integrity validation
 */
export interface IntegrityReport {
  /** Whether the chain is valid */
  valid: boolean;
  /** Total blocks checked */
  totalBlocks: number;
  /** Index of first invalid block, if any */
  invalidBlockIndex?: number;
  /** Description of the integrity violation */
  errorMessage?: string;
  /** Hash chain head at time of validation */
  headHash: string;
}

/**
 * Verification result for a single memory
 */
export interface VerificationResult {
  /** Whether the content matches the recorded hash */
  verified: boolean;
  /** The UOR ID checked */
  uorId: string;
  /** Expected hash from chain */
  expectedHash: string;
  /** Computed hash from provided content */
  computedHash: string;
}
