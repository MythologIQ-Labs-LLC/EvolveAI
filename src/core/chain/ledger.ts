/**
 * Hash Chain Ledger Management
 * Append-only chain with O(1) lookup by UOR ID
 */

import type {
  Block,
  BlockMetadata,
  MemoryOperation,
  ImmutableMemory,
  IntegrityReport
} from './types';
import { createBlock, createGenesisBlock, GENESIS_HASH } from './block';
import { validateChain, validateBlockIntegrity } from './verify';

/**
 * In-memory hash chain ledger
 * Maintains both sequential blocks and UOR index
 */
export class HashChainLedger {
  private blocks: Block[] = [];
  private uorIndex: Map<string, number> = new Map();
  private contentStore: Map<string, unknown> = new Map();

  /**
   * Initialize chain with optional genesis content
   */
  initialize(genesisContent?: unknown, metadata?: Partial<BlockMetadata>): Block {
    if (this.blocks.length > 0) {
      throw new Error('Chain already initialized');
    }

    const content = genesisContent ?? { type: 'GENESIS', timestamp: Date.now() };
    const genesis = createGenesisBlock(content, metadata);

    this.blocks.push(genesis);
    this.uorIndex.set(genesis.uorId, 0);
    this.contentStore.set(genesis.uorId, content);

    return genesis;
  }

  /**
   * Append a new block to the chain
   */
  append(
    content: unknown,
    operation: MemoryOperation,
    metadata?: Partial<BlockMetadata>
  ): Block {
    if (this.blocks.length === 0) {
      throw new Error('Chain not initialized. Call initialize() first.');
    }

    const previousBlock = this.blocks[this.blocks.length - 1];
    const newBlock = createBlock(
      this.blocks.length,
      content,
      operation,
      previousBlock.blockHash,
      metadata
    );

    // Validate before appending
    if (!validateBlockIntegrity(newBlock, previousBlock)) {
      throw new Error('Block validation failed');
    }

    this.blocks.push(newBlock);
    this.uorIndex.set(newBlock.uorId, newBlock.index);
    this.contentStore.set(newBlock.uorId, content);

    return newBlock;
  }

  /**
   * Retrieve immutable memory by UOR ID
   * O(1) lookup via index
   */
  retrieve(uorId: string): ImmutableMemory | null {
    const blockIndex = this.uorIndex.get(uorId);
    if (blockIndex === undefined) {
      return null;
    }

    const block = this.blocks[blockIndex];
    const content = this.contentStore.get(uorId);

    if (!content) {
      return null;
    }

    return {
      uorId: block.uorId,
      content,
      contentHash: block.contentHash,
      blockIndex: block.index,
      crystallizedAt: block.timestamp
    };
  }

  /**
   * Get the current chain head
   */
  getHead(): Block | null {
    if (this.blocks.length === 0) {
      return null;
    }
    return this.blocks[this.blocks.length - 1];
  }

  /**
   * Get block by index
   */
  getBlock(index: number): Block | null {
    if (index < 0 || index >= this.blocks.length) {
      return null;
    }
    return this.blocks[index];
  }

  /**
   * Get total block count
   */
  getLength(): number {
    return this.blocks.length;
  }

  /**
   * Check if UOR ID exists in chain
   */
  has(uorId: string): boolean {
    return this.uorIndex.has(uorId);
  }

  /**
   * Validate entire chain integrity
   */
  validateIntegrity(): IntegrityReport {
    return validateChain(this.blocks);
  }

  /**
   * Export chain for persistence
   */
  export(): { blocks: Block[]; contents: Array<[string, unknown]> } {
    return {
      blocks: [...this.blocks],
      contents: Array.from(this.contentStore.entries())
    };
  }

  /**
   * Import chain from persistence
   */
  import(data: { blocks: Block[]; contents: Array<[string, unknown]> }): void {
    // Validate imported chain
    const report = validateChain(data.blocks);
    if (!report.valid) {
      throw new Error(`Invalid chain: ${report.errorMessage}`);
    }

    this.blocks = [...data.blocks];
    this.contentStore = new Map(data.contents);

    // Rebuild UOR index
    this.uorIndex.clear();
    for (const block of this.blocks) {
      this.uorIndex.set(block.uorId, block.index);
    }
  }
}

/**
 * Create a new ledger instance
 */
export function createLedger(): HashChainLedger {
  return new HashChainLedger();
}
