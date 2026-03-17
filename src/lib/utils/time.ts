/**
 * Temporal utilities for memory operations
 * Section 4 Razor: Single responsibility - time management
 */

export function now(): number {
  return Date.now();
}

export function elapsed(from: number): number {
  return now() - from;
}

export function toISOString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function fromISOString(iso: string): number {
  return new Date(iso).getTime();
}
