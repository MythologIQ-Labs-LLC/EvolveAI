/**
 * Lifecycle Type Definitions
 * 5-Phase Metabolic Lifecycle structures
 */

import type { Phase } from '../memory/types';

/**
 * Base context established during grounding
 */
export interface BaseContext {
  /** Session identifier */
  sessionId: string;
  /** Soul file content if available */
  soulFile?: unknown;
  /** User/agent identity */
  identity?: string;
  /** Established constraints */
  constraints: ContextConstraints;
  /** Timestamp of grounding */
  groundedAt: number;
}

/**
 * Constraints applied to context
 */
export interface ContextConstraints {
  /** Maximum tokens for this session */
  maxTokens?: number;
  /** Allowed operation types */
  allowedOperations?: string[];
  /** Restricted patterns */
  restrictions?: string[];
}

/**
 * Fiber budget for resource management
 */
export interface FiberBudget {
  /** Remaining memory quota */
  memoryQuota: number;
  /** Remaining compute cycles */
  computeCycles: number;
  /** Time budget in ms */
  timeMs: number;
  /** Token budget */
  tokenBudget: number;
}

/**
 * Full lifecycle state
 */
export interface LifecycleState {
  /** Current phase */
  currentPhase: Phase;
  /** Session identifier */
  sessionId: string;
  /** Base context from grounding */
  baseContext: BaseContext | null;
  /** Resource budget */
  fiberBudget: FiberBudget | null;
  /** Collected pipeline traces */
  traces: PipelineTrace[];
  /** Phase transition timestamps */
  phaseTimestamps: Record<Phase, number>;
  /** Error state if any */
  error?: LifecycleError;
}

/**
 * Pipeline trace for tracking operations
 */
export interface PipelineTrace {
  /** Trace identifier */
  id: string;
  /** Phase during which trace was created */
  phase: Phase;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp */
  endedAt?: number;
  /** Operation type */
  operation: string;
  /** Whether operation succeeded */
  success: boolean;
  /** Input summary */
  input: unknown;
  /** Output summary */
  output?: unknown;
  /** Error if failed */
  error?: string;
}

/**
 * Lifecycle error state
 */
export interface LifecycleError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Phase where error occurred */
  phase: Phase;
  /** Timestamp */
  timestamp: number;
  /** Whether error is recoverable */
  recoverable: boolean;
}

/**
 * Lifecycle configuration
 */
export interface LifecycleConfig {
  /** Number of traces before REM synthesis triggers */
  synthesisThreshold: number;
  /** Detachment strategy */
  detachmentStrategy: 'immediate' | 'batched';
  /** Grounding timeout in ms */
  groundingTimeout: number;
  /** Default fiber budget */
  defaultFiberBudget: FiberBudget;
}

/**
 * Phase transition event
 */
export interface PhaseTransition {
  /** Previous phase */
  from: Phase;
  /** New phase */
  to: Phase;
  /** Transition timestamp */
  timestamp: number;
  /** Trigger for transition */
  trigger: string;
}

/**
 * Default lifecycle configuration
 */
export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  synthesisThreshold: 10,
  detachmentStrategy: 'immediate',
  groundingTimeout: 5000,
  defaultFiberBudget: {
    memoryQuota: 1024 * 1024 * 100, // 100MB
    computeCycles: 10000,
    timeMs: 30000,
    tokenBudget: 4000
  }
};

/**
 * Initial lifecycle state
 */
export function createInitialState(sessionId: string): LifecycleState {
  const timestamp = Date.now();
  return {
    currentPhase: 'IDLE',
    sessionId,
    baseContext: null,
    fiberBudget: null,
    traces: [],
    phaseTimestamps: {
      IDLE: timestamp,
      GROUNDING: 0,
      SEMANTIC_PAUSE: 0,
      ACTIVE_FLOW: 0,
      DETACHMENT: 0,
      REM_SYNTHESIS: 0
    }
  };
}
