/**
 * Cryptographic hashing utilities for UOR
 * Section 4 Razor: Single responsibility - content hashing
 */

import { createHash } from 'crypto';

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function hashObject(obj: unknown): string {
  const normalized = JSON.stringify(obj, Object.keys(obj as object).sort());
  return sha256(normalized);
}

export function verifyHash(content: string, expectedHash: string): boolean {
  return sha256(content) === expectedHash;
}
