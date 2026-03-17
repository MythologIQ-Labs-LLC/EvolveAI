/**
 * Phase 2: Semantic Pause
 * Safety check against Shadow Genome before execution
 */

import type { SafetyVerdict, IntentPayload } from '../../shadow/interceptor';
import type { ShadowInterceptor } from '../../shadow/interceptor';

/**
 * Semantic pause result
 */
export interface SemanticPauseResult {
  /** Whether intent passed safety check */
  passed: boolean;
  /** Safety verdict from interceptor */
  verdict: SafetyVerdict;
  /** Time taken for safety check in ms */
  checkDurationMs: number;
}

/**
 * Blocked result when intent fails semantic pause
 */
export interface BlockedResult {
  /** Reason for blocking */
  reason: string;
  /** Matched constraints that caused block */
  constraints: string[];
  /** Highest similarity score */
  similarity: number;
  /** Suggested alternatives if any */
  alternatives?: string[];
}

/**
 * Execute semantic pause phase
 */
export function executeSemanticPause(
  intent: IntentPayload,
  interceptor: ShadowInterceptor
): SemanticPauseResult {
  const startTime = Date.now();

  const verdict = interceptor.check(intent);

  const endTime = Date.now();

  return {
    passed: verdict.verdict === 'PASS',
    verdict,
    checkDurationMs: endTime - startTime
  };
}

/**
 * Create blocked result from verdict
 */
export function createBlockedResult(verdict: SafetyVerdict): BlockedResult {
  return {
    reason: verdict.reasoning,
    constraints: verdict.matchedConstraints.map(c => c.failureType),
    similarity: verdict.highestSimilarity
  };
}

/**
 * Check if pause should be skipped (bypass mode)
 */
export function shouldSkipPause(
  context: { bypassSafetyCheck?: boolean }
): boolean {
  return context.bypassSafetyCheck === true;
}

/**
 * Create a passing semantic pause result for bypass mode
 */
export function createBypassResult(): SemanticPauseResult {
  return {
    passed: true,
    verdict: {
      verdict: 'PASS',
      matchedConstraints: [],
      highestSimilarity: 0,
      reasoning: 'Safety check bypassed'
    },
    checkDurationMs: 0
  };
}

/**
 * Log semantic pause result for debugging
 */
export function formatPauseResult(result: SemanticPauseResult): string {
  if (result.passed) {
    return `PASS (${result.checkDurationMs}ms): ${result.verdict.reasoning}`;
  }

  const constraintTypes = result.verdict.matchedConstraints
    .map(c => c.failureType)
    .join(', ');

  return `BLOCK (${result.checkDurationMs}ms): ${result.verdict.reasoning} [${constraintTypes}]`;
}
