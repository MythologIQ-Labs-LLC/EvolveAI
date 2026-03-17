/**
 * Lifecycle Orchestrator
 * State machine for 5-Phase Metabolic Lifecycle
 */

import type {
  LifecycleState,
  LifecycleConfig,
  PhaseTransition,
  LifecycleError,
  PipelineTrace
} from './types';
import type { Phase } from '../memory/types';
import { createInitialState, DEFAULT_LIFECYCLE_CONFIG } from './types';
import { executeGrounding, type GroundingConfig, type SoulFileRetriever } from './phases/grounding';
import { executeSemanticPause, createBypassResult, type SemanticPauseResult } from './phases/semantic-pause';
import { createFlowContext, executeTracedOperation, accumulateResult, hasBudget, type FlowContext, type FlowResult } from './phases/active-flow';
import { executeDetachment, type DetachmentContext, type DetachmentResult } from './phases/detachment';
import { executeRemSynthesis, clearProcessedTraces, type SynthesisContext, type SynthesisResult } from './phases/rem-synthesis';
import type { IntentPayload, ShadowInterceptor } from '../shadow/interceptor';
import type { L1Cache } from '../tiers/l1-cache';
import type { L2GraphStore } from '../tiers/l2-graph';
import type { L3Vault } from '../tiers/l3-vault';
import { now } from '../../lib/utils/time';

/**
 * Lifecycle Orchestrator implementation
 */
export class LifecycleOrchestrator {
  private state: LifecycleState;
  private config: LifecycleConfig;
  private transitions: PhaseTransition[] = [];

  // External dependencies (optional)
  private shadowInterceptor?: ShadowInterceptor;
  private soulRetriever?: SoulFileRetriever;
  private l1Cache?: L1Cache;
  private l2Graph?: L2GraphStore;
  private l3Vault?: L3Vault;
  private embedder?: (text: string) => Promise<Float32Array>;

  constructor(
    sessionId: string,
    config: LifecycleConfig = { ...DEFAULT_LIFECYCLE_CONFIG }
  ) {
    this.state = createInitialState(sessionId);
    this.config = config;
  }

  /**
   * Configure external dependencies
   */
  configure(deps: {
    shadowInterceptor?: ShadowInterceptor;
    soulRetriever?: SoulFileRetriever;
    l1Cache?: L1Cache;
    l2Graph?: L2GraphStore;
    l3Vault?: L3Vault;
    embedder?: (text: string) => Promise<Float32Array>;
  }): void {
    Object.assign(this, deps);
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): Phase {
    return this.state.currentPhase;
  }

  /**
   * Get current state
   */
  getState(): Readonly<LifecycleState> {
    return this.state;
  }

  /**
   * Transition to a new phase
   */
  private transition(to: Phase, trigger: string): void {
    const from = this.state.currentPhase;
    const timestamp = now();

    this.transitions.push({ from, to, timestamp, trigger });

    this.state = {
      ...this.state,
      currentPhase: to,
      phaseTimestamps: {
        ...this.state.phaseTimestamps,
        [to]: timestamp
      }
    };
  }

  /**
   * Start session (IDLE → GROUNDING → SEMANTIC_PAUSE ready)
   */
  async startSession(config: GroundingConfig = {}): Promise<void> {
    this.assertPhase('IDLE');

    this.transition('GROUNDING', 'startSession');

    const result = await executeGrounding(
      this.state.sessionId,
      config,
      this.config,
      this.soulRetriever
    );

    this.state = {
      ...this.state,
      baseContext: result.context,
      fiberBudget: result.fiberBudget
    };

    // Auto-transition to ready for semantic pause
    this.transition('IDLE', 'groundingComplete');
  }

  /**
   * Execute semantic pause (safety check)
   */
  checkIntent(intent: IntentPayload): SemanticPauseResult {
    if (!this.shadowInterceptor) {
      return createBypassResult();
    }

    this.transition('SEMANTIC_PAUSE', 'checkIntent');

    const result = executeSemanticPause(intent, this.shadowInterceptor);

    if (result.passed) {
      this.transition('ACTIVE_FLOW', 'semanticPausePass');
    } else {
      this.transition('IDLE', 'semanticPauseBlock');
    }

    return result;
  }

  /**
   * Execute an operation within active flow
   */
  async executeOperation<T>(
    operation: string,
    input: unknown,
    executor: () => Promise<T>
  ): Promise<FlowResult<T>> {
    this.assertPhase('ACTIVE_FLOW');
    this.assertContext();
    this.assertBudget();

    const flowContext = createFlowContext(
      this.state.baseContext!,
      this.state.fiberBudget!,
      this.state.traces
    );

    const result = await executeTracedOperation(
      operation,
      input,
      executor,
      flowContext
    );

    // Update state with trace and budget
    const updatedContext = accumulateResult(
      flowContext,
      result.trace,
      result.remainingBudget
    );

    this.state = {
      ...this.state,
      traces: updatedContext.traces,
      fiberBudget: updatedContext.fiberBudget
    };

    return result;
  }

  /**
   * Execute detachment phase
   */
  detach(): DetachmentResult {
    this.transition('DETACHMENT', 'detach');

    const context: DetachmentContext = {
      l1Cache: this.l1Cache,
      l2Graph: this.l2Graph,
      traces: this.state.traces,
      config: this.config
    };

    const result = executeDetachment(context);

    if (result.shouldSynthesize) {
      this.transition('REM_SYNTHESIS', 'synthesisThresholdReached');
    } else {
      this.transition('IDLE', 'detachmentComplete');
    }

    return result;
  }

  /**
   * Execute REM synthesis
   */
  async synthesize(): Promise<SynthesisResult> {
    this.assertPhase('REM_SYNTHESIS');

    const context: SynthesisContext = {
      traces: this.state.traces,
      l2Graph: this.l2Graph,
      l3Vault: this.l3Vault,
      shadowGenome: this.shadowInterceptor?.['genome'],
      embedder: this.embedder
    };

    const result = await executeRemSynthesis(context);

    // Clear traces after synthesis
    this.state = {
      ...this.state,
      traces: clearProcessedTraces(this.state.traces)
    };

    this.transition('IDLE', 'synthesisComplete');

    return result;
  }

  /**
   * Force transition to IDLE (reset)
   */
  reset(): void {
    this.transition('IDLE', 'reset');
    this.state = {
      ...this.state,
      traces: [],
      error: undefined
    };
  }

  /**
   * Get transition history
   */
  getTransitions(): PhaseTransition[] {
    return [...this.transitions];
  }

  /**
   * Assert current phase
   */
  private assertPhase(expected: Phase): void {
    if (this.state.currentPhase !== expected) {
      throw new Error(
        `Invalid phase: expected ${expected}, got ${this.state.currentPhase}`
      );
    }
  }

  /**
   * Assert context is established
   */
  private assertContext(): void {
    if (!this.state.baseContext) {
      throw new Error('No base context. Call startSession() first.');
    }
  }

  /**
   * Assert budget is available
   */
  private assertBudget(): void {
    if (!this.state.fiberBudget || !hasBudget(this.state.fiberBudget)) {
      throw new Error('No fiber budget available.');
    }
  }
}

/**
 * Create a new orchestrator instance
 */
export function createOrchestrator(
  sessionId: string,
  config?: LifecycleConfig
): LifecycleOrchestrator {
  return new LifecycleOrchestrator(sessionId, config);
}
