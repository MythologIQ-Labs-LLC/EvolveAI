/**
 * Neural Net Processor
 * Main facade for the Autopoietic Memory System
 */

import type {
  ProcessorInitResult,
  EncodeResult,
  ProcessorQueryResult,
  SafetyCheckResult,
  ProcessorStats,
  HealthCheckResult,
  ProcessorEvent,
  ProcessorEventListener
} from './types';
import type { ProcessorConfig } from './config';
import { createProcessorConfig, DEFAULT_PROCESSOR_CONFIG, validateConfig } from './config';
import type { RawInput, Query, RecallResult, MemoryUnit } from '../memory/types';
import { encodeInput, createEncoder } from '../memory/encoder';
import { decodeQuery, createDecoder } from '../memory/decoder';
import { routeMemoryUnit } from '../tiers/router';
import { createL1Cache, type L1Cache } from '../tiers/l1-cache';
import { createL2GraphStore, type L2GraphStore } from '../tiers/l2-graph';
import { createL3Vault, type L3Vault } from '../tiers/l3-vault';
import { createShadowGenome, type ShadowGenome } from '../shadow/genome';
import { createInterceptor, type ShadowInterceptor, type IntentPayload } from '../shadow/interceptor';
import { createOrchestrator, type LifecycleOrchestrator } from '../lifecycle/orchestrator';
import type { GroundingConfig } from '../lifecycle/phases/grounding';
import { now } from '../../lib/utils/time';
import { generateId } from '../../lib/utils/id';

/**
 * Neural Net Processor - Main entry point
 */
export class NeuralNetProcessor {
  private config: ProcessorConfig;
  private orchestrator: LifecycleOrchestrator;
  private l1Cache: L1Cache;
  private l2Graph: L2GraphStore;
  private l3Vault: L3Vault;
  private shadowGenome: ShadowGenome;
  private shadowInterceptor: ShadowInterceptor;
  private listeners: ProcessorEventListener[] = [];
  private startedAt: number;
  private initialized = false;

  constructor(config: Partial<ProcessorConfig> = {}) {
    this.config = createProcessorConfig(config);
    this.startedAt = now();

    // Validate configuration
    const errors = validateConfig(this.config);
    if (errors.length > 0) {
      throw new Error(`Invalid config: ${errors.join(', ')}`);
    }

    // Initialize subsystems
    this.l1Cache = createL1Cache(this.config.l1Cache);
    this.l2Graph = createL2GraphStore(this.config.l2Graph);
    this.l3Vault = createL3Vault(this.config.l3Vault);
    this.shadowGenome = createShadowGenome(this.config.shadowGenome);
    this.shadowInterceptor = createInterceptor(this.shadowGenome, this.config.interceptor);

    // Initialize orchestrator with session ID
    const sessionId = generateId();
    this.orchestrator = createOrchestrator(sessionId, this.config.lifecycle);

    // Configure orchestrator dependencies
    this.orchestrator.configure({
      shadowInterceptor: this.shadowInterceptor,
      l1Cache: this.l1Cache,
      l2Graph: this.l2Graph,
      l3Vault: this.l3Vault,
      embedder: (text) => this.embed(text)
    });
  }

  /**
   * Initialize the processor and start session
   */
  async initialize(groundingConfig: GroundingConfig = {}): Promise<ProcessorInitResult> {
    try {
      // Initialize L3 vault
      const genesisBlock = this.l3Vault.initialize({
        sourcePhase: 'BOOTSTRAP'
      });

      // Start L1 cache eviction
      this.l1Cache.startEviction();

      // Start orchestrator session
      await this.orchestrator.startSession(groundingConfig);

      this.initialized = true;

      return {
        success: true,
        sessionId: this.orchestrator.getState().sessionId,
        genesisHash: genesisBlock.blockHash
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        sessionId: '',
        error: message
      };
    }
  }

  /**
   * Encode input into memory
   */
  async encode(input: RawInput): Promise<EncodeResult> {
    this.assertInitialized();

    try {
      // Create memory unit
      const unit = await encodeInput(input, {
        ...this.config.mtsWeights,
        embeddingDimension: this.config.embedding.dimensions
      });

      // Route to tier
      const tierDecision = routeMemoryUnit(
        unit,
        this.config.mtsWeights,
        this.config.tierThresholds
      );

      // Store in appropriate tier
      switch (tierDecision.tier) {
        case 'L1':
          this.l1Cache.insert(unit);
          break;
        case 'L2':
          this.l2Graph.insert(unit);
          break;
        case 'L3':
          this.l3Vault.crystallize(unit, { sourcePhase: 'ENCODING' });
          break;
      }

      this.emit({
        type: 'MEMORY_ENCODED',
        unitId: unit.uor_id,
        tier: tierDecision.tier
      });

      return {
        unit,
        tierDecision,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'ERROR', error: message });
      return {
        unit: null as any,
        tierDecision: null as any,
        success: false,
        error: message
      };
    }
  }

  /**
   * Query memory
   */
  async query(query: Query): Promise<ProcessorQueryResult> {
    this.assertInitialized();
    const startTime = now();

    try {
      // Decode query across tiers
      const recall = await decodeQuery(query, {
        l1Cache: this.l1Cache,
        l2Graph: this.l2Graph,
        l3Vault: this.l3Vault,
        decayConfig: this.config.decay
      });

      return {
        recall,
        phase: this.orchestrator.getCurrentPhase(),
        executionTimeMs: now() - startTime,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        recall: { memories: [], trace: null as any },
        phase: this.orchestrator.getCurrentPhase(),
        executionTimeMs: now() - startTime,
        success: false,
        error: message
      };
    }
  }

  /**
   * Check intent safety before execution
   */
  checkSafety(intent: IntentPayload): SafetyCheckResult {
    this.assertInitialized();

    const result = this.orchestrator.checkIntent(intent);

    if (!result.passed) {
      this.emit({
        type: 'SAFETY_BLOCK',
        reason: result.verdict.reasoning
      });
    }

    return {
      passed: result.passed,
      verdict: result.verdict,
      phase: this.orchestrator.getCurrentPhase()
    };
  }

  /**
   * Trigger detachment phase
   */
  detach(): void {
    this.assertInitialized();
    this.orchestrator.detach();
  }

  /**
   * Trigger REM synthesis
   */
  async synthesize(): Promise<void> {
    this.assertInitialized();

    const result = await this.orchestrator.synthesize();

    this.emit({
      type: 'SYNTHESIS_COMPLETE',
      result
    });
  }

  /**
   * Get processor statistics
   */
  getStats(): ProcessorStats {
    const state = this.orchestrator.getState();
    const l2Size = this.l2Graph.size();

    return {
      currentPhase: state.currentPhase,
      sessionId: state.sessionId,
      l1Size: this.l1Cache.size(),
      l2Size,
      l3ChainLength: this.l3Vault.getChainLength(),
      shadowGenomeSize: this.shadowGenome.getStats().activeEntries,
      traceCount: state.traces.length,
      uptimeMs: now() - this.startedAt
    };
  }

  /**
   * Run health check
   */
  healthCheck(): HealthCheckResult {
    const vaultIntegrity = this.l3Vault.validateIntegrity();

    return {
      healthy: vaultIntegrity.valid,
      vaultIntegrity,
      components: {
        lifecycle: this.initialized,
        l1Cache: true,
        l2Graph: true,
        l3Vault: vaultIntegrity.valid,
        shadowGenome: true
      }
    };
  }

  /**
   * Add event listener
   */
  on(listener: ProcessorEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Emit event to listeners
   */
  private emit(event: ProcessorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Shutdown processor
   */
  shutdown(): void {
    this.l1Cache.stopEviction();
    this.orchestrator.reset();
    this.initialized = false;
  }

  /**
   * Assert processor is initialized
   */
  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error('Processor not initialized. Call initialize() first.');
    }
  }

  /**
   * Generate embedding for text (placeholder)
   */
  private async embed(text: string): Promise<Float32Array> {
    // Placeholder - in real implementation would use embedding model
    const hash = text.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
    const embedding = new Float32Array(this.config.embedding.dimensions);
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = Math.sin(hash * (i + 1)) * 0.5;
    }
    return embedding;
  }
}

/**
 * Create a new Neural Net Processor instance
 */
export function createProcessor(config?: Partial<ProcessorConfig>): NeuralNetProcessor {
  return new NeuralNetProcessor(config);
}

// Re-export types
export * from './types';
export * from './config';
