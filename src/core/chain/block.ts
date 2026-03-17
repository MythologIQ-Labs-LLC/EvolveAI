/**
 * Block Structure for L3 UOR Vault
 * Immutable block creation and validation
 */

import type { Block, BlockMetadata, MemoryOperation } from './types';
import { computeBlockHash, hashContent } from './hash';
import { now } from '../../lib/utils/time';

/** Genesis block previous hash marker */
export const GENESIS_HASH = 'GENESIS';

/**
 * Create a new block for the hash chain
 */
export function createBlock(
  index: number,
  content: unknown,
  operation: MemoryOperation,
  previousHash: string,
  metadata: Partial<BlockMetadata> = {}
): Block {
  const timestamp = now();
  const contentHash = hashContent(content);
  const uorId = contentHash; // UOR ID is content-addressed

  const fullMetadata: BlockMetadata = {
    sourcePhase: metadata.sourcePhase ?? 'UNKNOWN',
    traceId: metadata.traceId,
    context: metadata.context
  };

  const blockHash = computeBlockHash(
    index,
    timestamp,
    uorId,
    contentHash,
    previousHash,
    operation,
    fullMetadata
  );

  return {
    index,
    timestamp,
    uorId,
    contentHash,
    previousHash,
    operation,
    metadata: fullMetadata,
    blockHash
  };
}

/**
 * Create the genesis block for a new chain
 */
export function createGenesisBlock(
  content: unknown,
  metadata: Partial<BlockMetadata> = {}
): Block {
  return createBlock(0, content, 'GENESIS', GENESIS_HASH, {
    ...metadata,
    sourcePhase: metadata.sourcePhase ?? 'BOOTSTRAP'
  });
}

/**
 * Validate block hash integrity
 */
export function validateBlockHash(block: Block): boolean {
  const computedHash = computeBlockHash(
    block.index,
    block.timestamp,
    block.uorId,
    block.contentHash,
    block.previousHash,
    block.operation,
    block.metadata
  );
  return computedHash === block.blockHash;
}

/**
 * Validate chain link between two blocks
 */
export function validateChainLink(
  currentBlock: Block,
  previousBlock: Block
): boolean {
  // Index must increment by 1
  if (currentBlock.index !== previousBlock.index + 1) {
    return false;
  }
  // Previous hash must match
  return currentBlock.previousHash === previousBlock.blockHash;
}
