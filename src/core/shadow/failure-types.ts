/**
 * Failure Type Taxonomy
 * Categories of failures tracked by Shadow Genome
 */

/**
 * Categories of failure patterns
 */
export type FailureCategory =
  | 'COMPLEXITY_VIOLATION'     // Code/logic exceeded complexity bounds
  | 'PREMATURE_OPTIMIZATION'   // Optimized without profiling data
  | 'HALLUCINATION'           // Generated incorrect or fabricated info
  | 'SECURITY_REGRESSION'     // Introduced security vulnerability
  | 'SCOPE_CREEP'             // Exceeded requested scope
  | 'TECHNICAL_DEBT'          // Introduced shortcuts requiring future work
  | 'RESOURCE_EXHAUSTION'     // Ran out of memory/time/tokens
  | 'INTEGRATION_FAILURE'     // Failed to integrate with existing code
  | 'TEST_FAILURE'            // Tests failed or were skipped
  | 'VALIDATION_ERROR';       // Input/output validation failed

/**
 * Severity levels for failures
 */
export type FailureSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * A record of a failure occurrence
 */
export interface FailureTrace {
  /** Unique trace identifier */
  id: string;
  /** Failure category */
  category: FailureCategory;
  /** Severity level */
  severity: FailureSeverity;
  /** When the failure occurred */
  timestamp: number;
  /** Intent that led to failure */
  intent: string;
  /** Context at time of failure */
  context: Record<string, unknown>;
  /** Error message or description */
  message: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Session ID where failure occurred */
  sessionId?: string;
}

/**
 * Failure category descriptions for understanding
 */
export const FAILURE_DESCRIPTIONS: Record<FailureCategory, string> = {
  COMPLEXITY_VIOLATION: 'Code exceeded acceptable complexity metrics (lines, nesting, cyclomatic)',
  PREMATURE_OPTIMIZATION: 'Optimization applied without performance data to justify it',
  HALLUCINATION: 'Generated information that is factually incorrect or fabricated',
  SECURITY_REGRESSION: 'Change introduced a security vulnerability or weakened security',
  SCOPE_CREEP: 'Work exceeded the originally requested scope without authorization',
  TECHNICAL_DEBT: 'Shortcuts taken that require future refactoring or fixes',
  RESOURCE_EXHAUSTION: 'Operation exceeded available resources (memory, time, tokens)',
  INTEGRATION_FAILURE: 'New code failed to integrate properly with existing codebase',
  TEST_FAILURE: 'Tests failed, were skipped, or coverage decreased',
  VALIDATION_ERROR: 'Input or output failed validation requirements'
};

/**
 * Default severity for each category
 */
export const DEFAULT_SEVERITY: Record<FailureCategory, FailureSeverity> = {
  COMPLEXITY_VIOLATION: 'MEDIUM',
  PREMATURE_OPTIMIZATION: 'LOW',
  HALLUCINATION: 'HIGH',
  SECURITY_REGRESSION: 'CRITICAL',
  SCOPE_CREEP: 'MEDIUM',
  TECHNICAL_DEBT: 'LOW',
  RESOURCE_EXHAUSTION: 'MEDIUM',
  INTEGRATION_FAILURE: 'HIGH',
  TEST_FAILURE: 'HIGH',
  VALIDATION_ERROR: 'MEDIUM'
};

/**
 * Create a failure trace record
 */
export function createFailureTrace(
  category: FailureCategory,
  intent: string,
  message: string,
  context: Record<string, unknown> = {},
  severity?: FailureSeverity
): FailureTrace {
  return {
    id: `fail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category,
    severity: severity ?? DEFAULT_SEVERITY[category],
    timestamp: Date.now(),
    intent,
    context,
    message
  };
}

/**
 * Check if failure is blocking (should halt execution)
 */
export function isBlockingFailure(trace: FailureTrace): boolean {
  return trace.severity === 'CRITICAL' || trace.severity === 'HIGH';
}
