/**
 * Chain Integrity Verification
 * Validates hash chain consistency and content integrity
 */

import type { Block, IntegrityReport, VerificationResult } from './types';
import { validateBlockHash, validateChainLink, GENESIS_HASH } from './block';
import { hashContent } from './hash';

/**
 * Validate a single block's internal integrity
 */
export function validateBlockIntegrity(
  block: Block,
  previousBlock?: Block
): boolean {
  // Validate block hash
  if (!validateBlockHash(block)) {
    return false;
  }

  // For genesis block, check special previous hash
  if (block.index === 0) {
    return block.previousHash === GENESIS_HASH;
  }

  // For non-genesis, validate chain link
  if (previousBlock) {
    return validateChainLink(block, previousBlock);
  }

  return true;
}

/**
 * Validate entire chain from genesis to head
 */
export function validateChain(blocks: Block[]): IntegrityReport {
  if (blocks.length === 0) {
    return {
      valid: false,
      totalBlocks: 0,
      errorMessage: 'Empty chain',
      headHash: ''
    };
  }

  // Validate genesis block
  const genesis = blocks[0];
  if (genesis.index !== 0 || genesis.previousHash !== GENESIS_HASH) {
    return {
      valid: false,
      totalBlocks: blocks.length,
      invalidBlockIndex: 0,
      errorMessage: 'Invalid genesis block',
      headHash: ''
    };
  }

  if (!validateBlockHash(genesis)) {
    return {
      valid: false,
      totalBlocks: blocks.length,
      invalidBlockIndex: 0,
      errorMessage: 'Genesis block hash mismatch',
      headHash: ''
    };
  }

  // Validate each subsequent block
  for (let i = 1; i < blocks.length; i++) {
    const current = blocks[i];
    const previous = blocks[i - 1];

    if (!validateBlockHash(current)) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        invalidBlockIndex: i,
        errorMessage: `Block ${i} hash mismatch`,
        headHash: previous.blockHash
      };
    }

    if (!validateChainLink(current, previous)) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        invalidBlockIndex: i,
        errorMessage: `Chain link broken at block ${i}`,
        headHash: previous.blockHash
      };
    }
  }

  const head = blocks[blocks.length - 1];
  return {
    valid: true,
    totalBlocks: blocks.length,
    headHash: head.blockHash
  };
}

/**
 * Verify content against stored hash
 */
export function verifyContent(
  content: unknown,
  expectedHash: string,
  uorId: string
): VerificationResult {
  const computedHash = hashContent(content);
  return {
    verified: computedHash === expectedHash,
    uorId,
    expectedHash,
    computedHash
  };
}

/**
 * Verify a memory unit exists and matches chain record
 */
export function verifyMemory(
  uorId: string,
  content: unknown,
  blocks: Block[]
): VerificationResult {
  // Find block with matching UOR ID
  const block = blocks.find(b => b.uorId === uorId);

  if (!block) {
    return {
      verified: false,
      uorId,
      expectedHash: '',
      computedHash: hashContent(content)
    };
  }

  return verifyContent(content, block.contentHash, uorId);
}

/**
 * Check if chain has been tampered with since a known checkpoint
 */
export function verifyCheckpoint(
  blocks: Block[],
  checkpointIndex: number,
  checkpointHash: string
): boolean {
  if (checkpointIndex < 0 || checkpointIndex >= blocks.length) {
    return false;
  }

  const block = blocks[checkpointIndex];
  return block.blockHash === checkpointHash;
}
