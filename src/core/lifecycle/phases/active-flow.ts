/**
 * Phase 3: Active Flow
 * Main execution phase with pipeline tracing
 */

import type { PipelineTrace, BaseContext, FiberBudget } from '../types';
import type { Query, RecallResult } from '../../memory/types';
import { createTrace, completeTrace, failTrace } from '../trace';
import { now } from '../../../lib/utils/time';

/**
 * Active flow execution context
 */
export interface FlowContext {
  /** Base context from grounding */
  baseContext: BaseContext;
  /** Current fiber budget */
  fiberBudget: FiberBudget;
  /** Collected traces */
  traces: PipelineTrace[];
}

/**
 * Flow execution result
 */
export interface FlowResult<T> {
  /** Execution output */
  output: T;
  /** Trace for this operation */
  trace: PipelineTrace;
  /** Updated fiber budget */
  remainingBudget: FiberBudget;
}

/**
 * Resolver interface for query dispatch
 */
export interface Resolver {
  type: string;
  resolve(query: Query, context: BaseContext): Promise<RecallResult>;
}

/**
 * Execute a traced operation within active flow
 */
export async function executeTracedOperation<T>(
  operation: string,
  input: unknown,
  executor: () => Promise<T>,
  context: FlowContext
): Promise<FlowResult<T>> {
  const trace = createTrace('ACTIVE_FLOW', operation, input);
  const startTime = now();

  try {
    const output = await executor();

    // Update budget
    const timeUsed = now() - startTime;
    const remainingBudget = deductFromBudget(context.fiberBudget, timeUsed);

    const completedTrace = completeTrace(trace, output);

    return {
      output,
      trace: completedTrace,
      remainingBudget
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failedTrace = failTrace(trace, errorMessage);

    throw new ActiveFlowError(errorMessage, failedTrace);
  }
}

/**
 * Deduct resources from fiber budget
 */
export function deductFromBudget(
  budget: FiberBudget,
  timeMs: number,
  tokens: number = 0,
  memory: number = 0
): FiberBudget {
  return {
    memoryQuota: Math.max(0, budget.memoryQuota - memory),
    computeCycles: Math.max(0, budget.computeCycles - 1),
    timeMs: Math.max(0, budget.timeMs - timeMs),
    tokenBudget: Math.max(0, budget.tokenBudget - tokens)
  };
}

/**
 * Check if budget allows more operations
 */
export function hasBudget(budget: FiberBudget): boolean {
  return (
    budget.computeCycles > 0 &&
    budget.timeMs > 0 &&
    budget.tokenBudget > 0
  );
}

/**
 * Error during active flow
 */
export class ActiveFlowError extends Error {
  readonly trace: PipelineTrace;

  constructor(message: string, trace: PipelineTrace) {
    super(message);
    this.name = 'ActiveFlowError';
    this.trace = trace;
  }
}

/**
 * Accumulate result into context
 */
export function accumulateResult(
  context: FlowContext,
  trace: PipelineTrace,
  remainingBudget: FiberBudget
): FlowContext {
  return {
    ...context,
    traces: [...context.traces, trace],
    fiberBudget: remainingBudget
  };
}

/**
 * Create flow context from lifecycle state
 */
export function createFlowContext(
  baseContext: BaseContext,
  fiberBudget: FiberBudget,
  existingTraces: PipelineTrace[] = []
): FlowContext {
  return {
    baseContext,
    fiberBudget,
    traces: [...existingTraces]
  };
}
