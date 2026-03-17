/**
 * Test Fixtures: Pipeline Traces
 */

import type { PipelineTrace } from '../../core/lifecycle/types';
import type { FailureTrace, FailureCategory } from '../../core/shadow/failure-types';

/**
 * Create a successful trace
 */
export function createSuccessTrace(
  operation: string = 'test_operation',
  input: unknown = { test: true },
  output: unknown = { result: 'success' }
): PipelineTrace {
  const timestamp = Date.now();
  return {
    id: `trace_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    phase: 'ACTIVE_FLOW',
    startedAt: timestamp - 100,
    endedAt: timestamp,
    operation,
    success: true,
    input,
    output
  };
}

/**
 * Create a failed trace
 */
export function createFailedTrace(
  operation: string = 'test_operation',
  input: unknown = { test: true },
  error: string = 'Test error'
): PipelineTrace {
  const timestamp = Date.now();
  return {
    id: `trace_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    phase: 'ACTIVE_FLOW',
    startedAt: timestamp - 100,
    endedAt: timestamp,
    operation,
    success: false,
    input,
    error
  };
}

/**
 * Create a batch of mixed traces
 */
export function createMixedTraces(
  successCount: number,
  failureCount: number
): PipelineTrace[] {
  const traces: PipelineTrace[] = [];

  for (let i = 0; i < successCount; i++) {
    traces.push(createSuccessTrace(`success_op_${i}`, { index: i }));
  }

  for (let i = 0; i < failureCount; i++) {
    traces.push(createFailedTrace(`failure_op_${i}`, { index: i }, `Error ${i}`));
  }

  return traces;
}

/**
 * Create a failure trace for shadow genome
 */
export function createShadowFailureTrace(
  category: FailureCategory,
  intent: string,
  message: string
): FailureTrace {
  return {
    id: `fail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category,
    severity: 'MEDIUM',
    timestamp: Date.now(),
    intent,
    context: {},
    message
  };
}

/**
 * Sample failure traces for testing shadow genome
 */
export const SAMPLE_FAILURE_TRACES: FailureTrace[] = [
  {
    id: 'fail_001',
    category: 'COMPLEXITY_VIOLATION',
    severity: 'MEDIUM',
    timestamp: Date.now(),
    intent: 'Write a function with deep nesting',
    context: { nestingLevel: 5 },
    message: 'Function exceeded maximum nesting depth'
  },
  {
    id: 'fail_002',
    category: 'SECURITY_REGRESSION',
    severity: 'CRITICAL',
    timestamp: Date.now(),
    intent: 'Add SQL query with user input',
    context: { queryType: 'SELECT' },
    message: 'SQL injection vulnerability detected'
  },
  {
    id: 'fail_003',
    category: 'HALLUCINATION',
    severity: 'HIGH',
    timestamp: Date.now(),
    intent: 'Explain quantum computing API',
    context: { topic: 'quantum' },
    message: 'Generated non-existent API documentation'
  }
];
