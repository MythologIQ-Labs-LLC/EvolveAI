/**
 * Cryptographic Hash Utilities for L3 UOR Vault
 * SHA256 hashing with canonical normalization
 */

import { sha256, hashObject } from '../../lib/utils/hash';

/**
 * Hash arbitrary content with canonical normalization
 */
export function hashContent(content: unknown): string {
  if (content === null || content === undefined) {
    return sha256('');
  }
  if (typeof content === 'string') {
    return sha256(content);
  }
  return hashObject(content);
}

/**
 * Generate a UOR identifier from content
 * Maps content to address in Z/(2^256)Z ring
 */
export function generateUorId(content: unknown): string {
  return hashContent(content);
}

/**
 * Compute block hash from block components
 * Ensures deterministic ordering of fields
 */
export function computeBlockHash(
  index: number,
  timestamp: number,
  uorId: string,
  contentHash: string,
  previousHash: string,
  operation: string,
  metadata: Record<string, unknown>
): string {
  const blockData = {
    index,
    timestamp,
    uorId,
    contentHash,
    previousHash,
    operation,
    metadata
  };
  return hashObject(blockData);
}

/**
 * Verify that computed hash matches expected hash
 */
export function verifyHash(content: unknown, expectedHash: string): boolean {
  const computedHash = hashContent(content);
  return computedHash === expectedHash;
}

/**
 * Chain two hashes together for linked verification
 */
export function chainHashes(currentHash: string, previousHash: string): string {
  return sha256(`${previousHash}:${currentHash}`);
}
