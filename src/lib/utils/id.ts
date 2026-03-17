/**
 * UOR ID generation utilities
 * Section 4 Razor: Single responsibility - content-addressed identifiers
 */

import { hashObject } from './hash';

export function generateUorId(content: unknown): string {
  return hashObject(content);
}

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `session_${timestamp}_${random}`;
}

export function isValidUorId(id: string): boolean {
  return /^[a-f0-9]{64}$/.test(id);
}

export function isValidSessionId(id: string): boolean {
  return /^session_[a-z0-9]+_[a-z0-9]+$/.test(id);
}
