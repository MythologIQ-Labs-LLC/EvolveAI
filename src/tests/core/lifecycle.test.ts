/**
 * Tests: Lifecycle Orchestrator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LifecycleOrchestrator,
  createOrchestrator
} from '../../core/lifecycle/orchestrator';
import { createInitialState, DEFAULT_LIFECYCLE_CONFIG } from '../../core/lifecycle/types';
import { createTrace, completeTrace, failTrace, getTraceStats } from '../../core/lifecycle/trace';
import { createMixedTraces } from '../fixtures/traces';

describe('Lifecycle Orchestrator', () => {
  let orchestrator: LifecycleOrchestrator;

  beforeEach(() => {
    orchestrator = createOrchestrator('test-session');
  });

  describe('Initial State', () => {
    it('should start in IDLE phase', () => {
      expect(orchestrator.getCurrentPhase()).toBe('IDLE');
    });

    it('should have session ID', () => {
      const state = orchestrator.getState();
      expect(state.sessionId).toBe('test-session');
    });
  });

  describe('Phase Transitions', () => {
    it('should transition through grounding', async () => {
      await orchestrator.startSession();
      // After grounding completes, returns to IDLE ready for next phase
      expect(orchestrator.getCurrentPhase()).toBe('IDLE');
    });

    it('should establish base context after grounding', async () => {
      await orchestrator.startSession({ identity: 'test-agent' });
      const state = orchestrator.getState();
      expect(state.baseContext).not.toBeNull();
      expect(state.baseContext?.identity).toBe('test-agent');
    });

    it('should allocate fiber budget after grounding', async () => {
      await orchestrator.startSession();
      const state = orchestrator.getState();
      expect(state.fiberBudget).not.toBeNull();
      expect(state.fiberBudget?.computeCycles).toBeGreaterThan(0);
    });

    it('should record transitions', async () => {
      await orchestrator.startSession();
      const transitions = orchestrator.getTransitions();
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions[0].from).toBe('IDLE');
      expect(transitions[0].to).toBe('GROUNDING');
    });
  });

  describe('Reset', () => {
    it('should return to IDLE on reset', async () => {
      await orchestrator.startSession();
      orchestrator.reset();
      expect(orchestrator.getCurrentPhase()).toBe('IDLE');
    });

    it('should clear traces on reset', async () => {
      await orchestrator.startSession();
      orchestrator.reset();
      const state = orchestrator.getState();
      expect(state.traces).toHaveLength(0);
    });
  });
});

describe('Pipeline Traces', () => {
  describe('createTrace', () => {
    it('should create trace with correct fields', () => {
      const trace = createTrace('ACTIVE_FLOW', 'test_op', { input: 'data' });
      expect(trace.phase).toBe('ACTIVE_FLOW');
      expect(trace.operation).toBe('test_op');
      expect(trace.success).toBe(false);
      expect(trace.startedAt).toBeDefined();
    });
  });

  describe('completeTrace', () => {
    it('should mark trace as successful', () => {
      const trace = createTrace('ACTIVE_FLOW', 'test_op', {});
      const completed = completeTrace(trace, { result: 'done' });
      expect(completed.success).toBe(true);
      expect(completed.endedAt).toBeDefined();
      expect(completed.output).toEqual({ result: 'done' });
    });
  });

  describe('failTrace', () => {
    it('should mark trace as failed with error', () => {
      const trace = createTrace('ACTIVE_FLOW', 'test_op', {});
      const failed = failTrace(trace, 'Something went wrong');
      expect(failed.success).toBe(false);
      expect(failed.error).toBe('Something went wrong');
    });
  });

  describe('getTraceStats', () => {
    it('should calculate correct statistics', () => {
      const traces = createMixedTraces(7, 3);
      const stats = getTraceStats(traces);

      expect(stats.total).toBe(10);
      expect(stats.successful).toBe(7);
      expect(stats.failed).toBe(3);
    });

    it('should group by operation', () => {
      const traces = createMixedTraces(3, 2);
      const stats = getTraceStats(traces);

      expect(Object.keys(stats.byOperation).length).toBeGreaterThan(0);
    });
  });
});

describe('Initial State Factory', () => {
  it('should create state with all phases timestamped to 0 except IDLE', () => {
    const state = createInitialState('test');
    expect(state.phaseTimestamps.IDLE).toBeGreaterThan(0);
    expect(state.phaseTimestamps.GROUNDING).toBe(0);
    expect(state.phaseTimestamps.REM_SYNTHESIS).toBe(0);
  });
});
