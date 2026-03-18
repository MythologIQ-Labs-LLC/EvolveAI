/**
 * Storage Adapter Tests
 * TDD-Light: Verify storage abstraction works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryAdapter, type MemoryAdapter } from '../../core/storage';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter<{ name: string; value: number }>;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  it('get returns null for non-existent key', async () => {
    const result = await adapter.get('nonexistent');
    expect(result).toBeNull();
  });

  it('set and get work correctly', async () => {
    const data = { name: 'test', value: 42 };
    await adapter.set('key1', data);

    const result = await adapter.get('key1');
    expect(result).toEqual(data);
  });

  it('has returns false for non-existent key', async () => {
    const result = await adapter.has('nonexistent');
    expect(result).toBe(false);
  });

  it('has returns true for existing key', async () => {
    await adapter.set('key1', { name: 'test', value: 1 });

    const result = await adapter.has('key1');
    expect(result).toBe(true);
  });

  it('delete removes existing key', async () => {
    await adapter.set('key1', { name: 'test', value: 1 });

    const deleted = await adapter.delete('key1');
    expect(deleted).toBe(true);

    const result = await adapter.get('key1');
    expect(result).toBeNull();
  });

  it('delete returns false for non-existent key', async () => {
    const deleted = await adapter.delete('nonexistent');
    expect(deleted).toBe(false);
  });

  it('keys iteration returns all stored keys', async () => {
    await adapter.set('key1', { name: 'one', value: 1 });
    await adapter.set('key2', { name: 'two', value: 2 });
    await adapter.set('key3', { name: 'three', value: 3 });

    const keys: string[] = [];
    for await (const key of adapter.keys()) {
      keys.push(key);
    }

    expect(keys).toHaveLength(3);
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
    expect(keys).toContain('key3');
  });

  it('values iteration returns all stored values', async () => {
    await adapter.set('key1', { name: 'one', value: 1 });
    await adapter.set('key2', { name: 'two', value: 2 });

    const values: Array<{ name: string; value: number }> = [];
    for await (const value of adapter.values()) {
      values.push(value);
    }

    expect(values).toHaveLength(2);
    expect(values).toContainEqual({ name: 'one', value: 1 });
    expect(values).toContainEqual({ name: 'two', value: 2 });
  });

  it('entries iteration returns all key-value pairs', async () => {
    await adapter.set('key1', { name: 'one', value: 1 });
    await adapter.set('key2', { name: 'two', value: 2 });

    const entries: Array<[string, { name: string; value: number }]> = [];
    for await (const entry of adapter.entries()) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(2);
  });

  it('clear removes all data', async () => {
    await adapter.set('key1', { name: 'one', value: 1 });
    await adapter.set('key2', { name: 'two', value: 2 });

    await adapter.clear();

    const size = await adapter.size();
    expect(size).toBe(0);
  });

  it('getBatch returns map of existing keys', async () => {
    await adapter.set('key1', { name: 'one', value: 1 });
    await adapter.set('key2', { name: 'two', value: 2 });

    const result = await adapter.getBatch(['key1', 'key2', 'key3']);

    expect(result.size).toBe(2);
    expect(result.get('key1')).toEqual({ name: 'one', value: 1 });
    expect(result.get('key2')).toEqual({ name: 'two', value: 2 });
    expect(result.has('key3')).toBe(false);
  });

  it('setBatch stores multiple entries', async () => {
    await adapter.setBatch([
      ['key1', { name: 'one', value: 1 }],
      ['key2', { name: 'two', value: 2 }]
    ]);

    const result1 = await adapter.get('key1');
    const result2 = await adapter.get('key2');

    expect(result1).toEqual({ name: 'one', value: 1 });
    expect(result2).toEqual({ name: 'two', value: 2 });
  });

  it('size returns correct count', async () => {
    expect(await adapter.size()).toBe(0);

    await adapter.set('key1', { name: 'one', value: 1 });
    expect(await adapter.size()).toBe(1);

    await adapter.set('key2', { name: 'two', value: 2 });
    expect(await adapter.size()).toBe(2);

    await adapter.delete('key1');
    expect(await adapter.size()).toBe(1);
  });

  it('close is no-op (does not throw)', async () => {
    await adapter.set('key1', { name: 'test', value: 1 });
    await expect(adapter.close()).resolves.toBeUndefined();
  });
});
