/**
 * Pipeline Trace Recording
 * Tracks operations during Active Flow phase
 */

import type { PipelineTrace, Phase } from './types';
import { now } from '../../lib/utils/time';

/**
 * Generate a unique trace ID
 */
function generateTraceId(): string {
  return `trace_${now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new pipeline trace
 */
export function createTrace(
  phase: Phase,
  operation: string,
  input: unknown
): PipelineTrace {
  return {
    id: generateTraceId(),
    phase,
    startedAt: now(),
    operation,
    success: false, // Updated on completion
    input
  };
}

/**
 * Complete a trace with success
 */
export function completeTrace(
  trace: PipelineTrace,
  output: unknown
): PipelineTrace {
  return {
    ...trace,
    endedAt: now(),
    success: true,
    output
  };
}

/**
 * Fail a trace with error
 */
export function failTrace(
  trace: PipelineTrace,
  error: string
): PipelineTrace {
  return {
    ...trace,
    endedAt: now(),
    success: false,
    error
  };
}

/**
 * Calculate trace duration in ms
 */
export function getTraceDuration(trace: PipelineTrace): number | null {
  if (!trace.endedAt) return null;
  return trace.endedAt - trace.startedAt;
}

/**
 * Filter traces by success status
 */
export function filterTracesBySuccess(
  traces: PipelineTrace[],
  success: boolean
): PipelineTrace[] {
  return traces.filter(t => t.success === success);
}

/**
 * Filter traces by phase
 */
export function filterTracesByPhase(
  traces: PipelineTrace[],
  phase: Phase
): PipelineTrace[] {
  return traces.filter(t => t.phase === phase);
}

/**
 * Get trace statistics
 */
export function getTraceStats(traces: PipelineTrace[]): {
  total: number;
  successful: number;
  failed: number;
  averageDurationMs: number;
  byOperation: Record<string, number>;
} {
  const successful = traces.filter(t => t.success).length;
  const completed = traces.filter(t => t.endedAt);
  const totalDuration = completed.reduce(
    (sum, t) => sum + (t.endedAt! - t.startedAt),
    0
  );

  const byOperation: Record<string, number> = {};
  for (const trace of traces) {
    byOperation[trace.operation] = (byOperation[trace.operation] ?? 0) + 1;
  }

  return {
    total: traces.length,
    successful,
    failed: traces.length - successful,
    averageDurationMs: completed.length > 0 ? totalDuration / completed.length : 0,
    byOperation
  };
}

/**
 * Extract patterns from successful traces
 */
export function extractSuccessPatterns(
  traces: PipelineTrace[]
): Array<{ operation: string; input: unknown; output: unknown }> {
  return traces
    .filter(t => t.success && t.output !== undefined)
    .map(t => ({
      operation: t.operation,
      input: t.input,
      output: t.output
    }));
}

/**
 * Extract patterns from failed traces
 */
export function extractFailurePatterns(
  traces: PipelineTrace[]
): Array<{ operation: string; input: unknown; error: string }> {
  return traces
    .filter(t => !t.success && t.error)
    .map(t => ({
      operation: t.operation,
      input: t.input,
      error: t.error!
    }));
}
