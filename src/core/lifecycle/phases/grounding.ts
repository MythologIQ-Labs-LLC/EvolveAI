/**
 * Phase 1: Grounding
 * Establishes session context and loads soul file
 */

import type { BaseContext, ContextConstraints, FiberBudget, LifecycleConfig } from '../types';
import { now } from '../../../lib/utils/time';

/**
 * Grounding configuration
 */
export interface GroundingConfig {
  /** Soul file UOR ID to load */
  soulFileUorId?: string;
  /** User/agent identity */
  identity?: string;
  /** Initial constraints */
  constraints?: Partial<ContextConstraints>;
  /** Custom fiber budget */
  fiberBudget?: Partial<FiberBudget>;
}

/**
 * Grounding result
 */
export interface GroundingResult {
  /** Established base context */
  context: BaseContext;
  /** Allocated fiber budget */
  fiberBudget: FiberBudget;
  /** Soul file if loaded */
  soulFile?: unknown;
}

/**
 * Soul file retriever interface
 */
export interface SoulFileRetriever {
  retrieve(uorId: string): Promise<unknown | null>;
}

/**
 * Execute grounding phase
 */
export async function executeGrounding(
  sessionId: string,
  config: GroundingConfig,
  lifecycleConfig: LifecycleConfig,
  soulRetriever?: SoulFileRetriever
): Promise<GroundingResult> {
  const timestamp = now();

  // Load soul file if configured
  let soulFile: unknown | undefined;
  if (config.soulFileUorId && soulRetriever) {
    soulFile = await soulRetriever.retrieve(config.soulFileUorId) ?? undefined;
  }

  // Build constraints
  const constraints: ContextConstraints = {
    maxTokens: config.constraints?.maxTokens,
    allowedOperations: config.constraints?.allowedOperations ?? [],
    restrictions: config.constraints?.restrictions ?? []
  };

  // Build base context
  const context: BaseContext = {
    sessionId,
    soulFile,
    identity: config.identity,
    constraints,
    groundedAt: timestamp
  };

  // Allocate fiber budget
  const defaultBudget = lifecycleConfig.defaultFiberBudget;
  const fiberBudget: FiberBudget = {
    memoryQuota: config.fiberBudget?.memoryQuota ?? defaultBudget.memoryQuota,
    computeCycles: config.fiberBudget?.computeCycles ?? defaultBudget.computeCycles,
    timeMs: config.fiberBudget?.timeMs ?? defaultBudget.timeMs,
    tokenBudget: config.fiberBudget?.tokenBudget ?? defaultBudget.tokenBudget
  };

  return {
    context,
    fiberBudget,
    soulFile
  };
}

/**
 * Validate grounding result
 */
export function validateGrounding(result: GroundingResult): boolean {
  // Context must have session ID and timestamp
  if (!result.context.sessionId || !result.context.groundedAt) {
    return false;
  }

  // Fiber budget must be positive
  if (result.fiberBudget.memoryQuota <= 0 ||
      result.fiberBudget.computeCycles <= 0 ||
      result.fiberBudget.timeMs <= 0) {
    return false;
  }

  return true;
}

/**
 * Create minimal grounding for testing
 */
export function createMinimalGrounding(sessionId: string): GroundingResult {
  return {
    context: {
      sessionId,
      constraints: {},
      groundedAt: now()
    },
    fiberBudget: {
      memoryQuota: 1024 * 1024,
      computeCycles: 1000,
      timeMs: 5000,
      tokenBudget: 1000
    }
  };
}
