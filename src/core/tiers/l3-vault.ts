/**
 * L3 UOR Vault
 * Immutable hash chain storage with O(1) lookup
 */

import type { MemoryUnit } from '../memory/types';
import type { Block, ImmutableMemory, IntegrityReport, BlockMetadata } from '../chain/types';
import { HashChainLedger, createLedger } from '../chain/ledger';
import { verifyContent } from '../chain/verify';

/**
 * L3 Vault configuration
 */
export interface L3VaultConfig {
  /** Whether to auto-verify on retrieval */
  verifyOnRetrieval: boolean;
  /** Genesis content for new vaults */
  genesisContent?: unknown;
}

export const DEFAULT_L3_CONFIG: L3VaultConfig = {
  verifyOnRetrieval: true
};

/**
 * L3 UOR Vault implementation
 */
export class L3Vault {
  private ledger: HashChainLedger;
  private unitStore: Map<string, MemoryUnit> = new Map();
  private config: L3VaultConfig;
  private initialized = false;

  constructor(config: L3VaultConfig = DEFAULT_L3_CONFIG) {
    this.ledger = createLedger();
    this.config = config;
  }

  /**
   * Initialize vault with genesis block
   */
  initialize(metadata?: Partial<BlockMetadata>): Block {
    if (this.initialized) {
      throw new Error('Vault already initialized');
    }

    const genesisContent = this.config.genesisContent ?? {
      type: 'VAULT_GENESIS',
      timestamp: Date.now(),
      version: '1.0.0'
    };

    const genesis = this.ledger.initialize(genesisContent, metadata);
    this.initialized = true;

    return genesis;
  }

  /**
   * Crystallize a memory unit into the vault
   */
  crystallize(
    unit: MemoryUnit,
    metadata?: Partial<BlockMetadata>
  ): Block {
    this.ensureInitialized();

    // Store the full unit
    this.unitStore.set(unit.uor_id, unit);

    // Append to chain with content (for hash verification)
    const block = this.ledger.append(
      unit.content,
      'CRYSTALLIZE',
      {
        ...metadata,
        sourcePhase: metadata?.sourcePhase ?? 'REM_SYNTHESIS'
      }
    );

    return block;
  }

  /**
   * Retrieve an immutable memory by UOR ID
   */
  retrieve(uorId: string): ImmutableMemory | null {
    this.ensureInitialized();

    const memory = this.ledger.retrieve(uorId);
    if (!memory) return null;

    // Verify integrity on retrieval if configured
    if (this.config.verifyOnRetrieval) {
      const verification = verifyContent(memory.content, memory.contentHash, uorId);
      if (!verification.verified) {
        throw new Error(`Integrity violation for ${uorId}`);
      }
    }

    return memory;
  }

  /**
   * Retrieve the full memory unit by UOR ID
   */
  retrieveUnit(uorId: string): MemoryUnit | null {
    this.ensureInitialized();

    const unit = this.unitStore.get(uorId);
    if (!unit) return null;

    // Verify if configured
    if (this.config.verifyOnRetrieval) {
      const memory = this.ledger.retrieve(uorId);
      if (!memory) return null;

      const verification = verifyContent(unit.content, memory.contentHash, uorId);
      if (!verification.verified) {
        throw new Error(`Integrity violation for ${uorId}`);
      }
    }

    return unit;
  }

  /**
   * Check if UOR ID exists in vault
   */
  has(uorId: string): boolean {
    return this.ledger.has(uorId);
  }

  /**
   * Deprecate a crystallized memory (mark as deprecated, doesn't delete)
   */
  deprecate(uorId: string, metadata?: Partial<BlockMetadata>): Block {
    this.ensureInitialized();

    if (!this.has(uorId)) {
      throw new Error(`Memory ${uorId} not found in vault`);
    }

    const block = this.ledger.append(
      { deprecatedUorId: uorId, deprecatedAt: Date.now() },
      'DEPRECATE',
      metadata
    );

    return block;
  }

  /**
   * Validate entire vault integrity
   */
  validateIntegrity(): IntegrityReport {
    return this.ledger.validateIntegrity();
  }

  /**
   * Get the current chain head
   */
  getHead(): Block | null {
    return this.ledger.getHead();
  }

  /**
   * Get chain length
   */
  getChainLength(): number {
    return this.ledger.getLength();
  }

  /**
   * Get block by index
   */
  getBlock(index: number): Block | null {
    return this.ledger.getBlock(index);
  }

  /**
   * Export vault for persistence
   */
  export(): {
    ledger: ReturnType<HashChainLedger['export']>;
    units: Array<[string, MemoryUnit]>;
  } {
    return {
      ledger: this.ledger.export(),
      units: Array.from(this.unitStore.entries())
    };
  }

  /**
   * Import vault from persistence
   */
  import(data: {
    ledger: ReturnType<HashChainLedger['export']>;
    units: Array<[string, MemoryUnit]>;
  }): void {
    this.ledger.import(data.ledger);
    this.unitStore = new Map(data.units);
    this.initialized = true;
  }

  /**
   * Ensure vault is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }
  }

  /**
   * Get vault statistics
   */
  getStats(): {
    chainLength: number;
    unitCount: number;
    headHash: string | null;
  } {
    const head = this.getHead();
    return {
      chainLength: this.getChainLength(),
      unitCount: this.unitStore.size,
      headHash: head?.blockHash ?? null
    };
  }
}

/**
 * Create a new L3 vault instance
 */
export function createL3Vault(config?: L3VaultConfig): L3Vault {
  return new L3Vault(config);
}
