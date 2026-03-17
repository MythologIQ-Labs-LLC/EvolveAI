/**
 * Tests: Hash Chain (L3 Vault)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HashChainLedger, createLedger } from '../../core/chain/ledger';
import { createBlock, createGenesisBlock, GENESIS_HASH } from '../../core/chain/block';
import { validateChain, verifyContent } from '../../core/chain/verify';
import { hashContent, generateUorId } from '../../core/chain/hash';

describe('Hash Chain', () => {
  describe('hashContent', () => {
    it('should produce consistent hashes for same content', () => {
      const content = 'test content';
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = hashContent('content A');
      const hash2 = hashContent('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('should hash objects deterministically', () => {
      const obj = { b: 2, a: 1 };
      const hash1 = hashContent(obj);
      const hash2 = hashContent({ a: 1, b: 2 });
      expect(hash1).toBe(hash2); // Normalized key order
    });
  });

  describe('Block Creation', () => {
    it('should create genesis block with GENESIS previous hash', () => {
      const block = createGenesisBlock({ type: 'genesis' });
      expect(block.index).toBe(0);
      expect(block.previousHash).toBe(GENESIS_HASH);
      expect(block.operation).toBe('GENESIS');
    });

    it('should create block with valid hash', () => {
      const block = createBlock(
        1,
        { data: 'test' },
        'CRYSTALLIZE',
        'previousHash123'
      );
      expect(block.blockHash).toBeDefined();
      expect(block.blockHash.length).toBe(64);
    });
  });

  describe('HashChainLedger', () => {
    let ledger: HashChainLedger;

    beforeEach(() => {
      ledger = createLedger();
    });

    it('should initialize with genesis block', () => {
      const genesis = ledger.initialize({ type: 'test_genesis' });
      expect(genesis.index).toBe(0);
      expect(ledger.getLength()).toBe(1);
    });

    it('should append blocks correctly', () => {
      ledger.initialize();
      const block = ledger.append({ data: 'test' }, 'CRYSTALLIZE');
      expect(block.index).toBe(1);
      expect(ledger.getLength()).toBe(2);
    });

    it('should retrieve content by UOR ID', () => {
      ledger.initialize();
      const content = { data: 'test_content' };
      const block = ledger.append(content, 'CRYSTALLIZE');

      const retrieved = ledger.retrieve(block.uorId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toEqual(content);
    });

    it('should validate chain integrity', () => {
      ledger.initialize();
      ledger.append({ data: 1 }, 'CRYSTALLIZE');
      ledger.append({ data: 2 }, 'CRYSTALLIZE');

      const report = ledger.validateIntegrity();
      expect(report.valid).toBe(true);
      expect(report.totalBlocks).toBe(3);
    });

    it('should throw when appending to uninitialized chain', () => {
      expect(() => ledger.append({}, 'CRYSTALLIZE')).toThrow();
    });
  });

  describe('Chain Verification', () => {
    it('should detect empty chain', () => {
      const report = validateChain([]);
      expect(report.valid).toBe(false);
      expect(report.errorMessage).toContain('Empty');
    });

    it('should validate correct chain', () => {
      const genesis = createGenesisBlock({});
      const block1 = createBlock(1, { data: 1 }, 'CRYSTALLIZE', genesis.blockHash);

      const report = validateChain([genesis, block1]);
      expect(report.valid).toBe(true);
    });

    it('should verify content against hash', () => {
      const content = 'test content';
      const hash = hashContent(content);

      const result = verifyContent(content, hash, 'test_uor');
      expect(result.verified).toBe(true);
    });

    it('should detect content tampering', () => {
      const originalHash = hashContent('original');

      const result = verifyContent('tampered', originalHash, 'test_uor');
      expect(result.verified).toBe(false);
    });
  });
});
