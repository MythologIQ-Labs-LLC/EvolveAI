/**
 * Decay Scheduler Tests
 * TDD-Light: Verify hybrid decay scheduler works correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createL2GraphStore, type L2GraphStore } from '../../core/tiers/l2-graph';
import {
  createDecayScheduler,
  type DecayScheduler,
  DEFAULT_SCHEDULER_CONFIG
} from '../../core/scheduler';

// Mock node creation helper
function createMockMemoryUnit(id: string) {
  return {
    uor_id: id,
    content: `content for ${id}`,
    embedding: new Float32Array(384).fill(0.1),
    metadata: {
      t_0: Date.now() - 1000,
      w_0: 1.0,
      lambda: 0.001,
      mts_score: 0.5,
      tier: 'L2' as const,
      source_phase: 'ACTIVE_FLOW' as const,
      session_id: 'test-session'
    }
  };
}

describe('DecayScheduler', () => {
  let l2Graph: L2GraphStore;
  let scheduler: DecayScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    l2Graph = createL2GraphStore();
    scheduler = createDecayScheduler(l2Graph, {
      backgroundTickEnabled: false,
      accessDecayEnabled: true,
      tickIntervalMs: 1000,
      pruneThreshold: 0.01,
      consolidationThreshold: 100
    });
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  describe('Configuration', () => {
    it('creates with default config', () => {
      const defaultScheduler = createDecayScheduler(l2Graph);
      const config = defaultScheduler.getConfig();

      expect(config.backgroundTickEnabled).toBe(DEFAULT_SCHEDULER_CONFIG.backgroundTickEnabled);
      expect(config.tickIntervalMs).toBe(DEFAULT_SCHEDULER_CONFIG.tickIntervalMs);
    });

    it('creates with custom config', () => {
      const customScheduler = createDecayScheduler(l2Graph, {
        tickIntervalMs: 5000,
        pruneThreshold: 0.05
      });

      const config = customScheduler.getConfig();
      expect(config.tickIntervalMs).toBe(5000);
      expect(config.pruneThreshold).toBe(0.05);
    });

    it('updateConfig modifies configuration', () => {
      scheduler.updateConfig({ pruneThreshold: 0.1 });

      const config = scheduler.getConfig();
      expect(config.pruneThreshold).toBe(0.1);
    });
  });

  describe('Manual Tick', () => {
    it('tick() returns updated stats', async () => {
      const stats = await scheduler.tick();

      expect(stats.totalTicks).toBe(1);
      expect(stats.lastTickAt).toBeGreaterThan(0);
    });

    it('tick() increments totalTicks', async () => {
      await scheduler.tick();
      await scheduler.tick();
      await scheduler.tick();

      const stats = scheduler.getStats();
      expect(stats.totalTicks).toBe(3);
    });

    it('tick() preserves healthy nodes', async () => {
      const unit = createMockMemoryUnit('healthy-node');
      l2Graph.insert(unit);

      await scheduler.tick();

      const node = l2Graph.getNode('healthy-node');
      expect(node).not.toBeNull();
    });

    it('tick() runs without error on empty graph', async () => {
      const stats = await scheduler.tick();
      expect(stats.nodesPruned).toBe(0);
    });
  });

  describe('Event-Driven Mode', () => {
    it('onAccess() returns decay event', async () => {
      const unit = createMockMemoryUnit('access-node');
      l2Graph.insert(unit);

      const event = await scheduler.onAccess('access-node');

      expect(event).not.toBeNull();
      expect(event!.type).toBe('ACCESS');
      expect(event!.nodeId).toBe('access-node');
      expect(event!.pruned).toBe(false);
    });

    it('onAccess() returns null for non-existent node', async () => {
      const event = await scheduler.onAccess('nonexistent');
      expect(event).toBeNull();
    });

    it('onAccess() increments accessDecayEvents', async () => {
      const unit = createMockMemoryUnit('event-node');
      l2Graph.insert(unit);

      await scheduler.onAccess('event-node');
      await scheduler.onAccess('event-node');

      const stats = scheduler.getStats();
      expect(stats.accessDecayEvents).toBe(2);
    });

    it('onAccess() respects accessDecayEnabled config', async () => {
      const disabledScheduler = createDecayScheduler(l2Graph, {
        accessDecayEnabled: false,
        backgroundTickEnabled: false
      });

      const unit = createMockMemoryUnit('disabled-node');
      l2Graph.insert(unit);

      const event = await disabledScheduler.onAccess('disabled-node');
      expect(event).toBeNull();
    });

    it('onAccess() event contains weight information', async () => {
      const unit = createMockMemoryUnit('weight-node');
      l2Graph.insert(unit);

      const event = await scheduler.onAccess('weight-node');

      expect(event).not.toBeNull();
      expect(typeof event!.oldWeight).toBe('number');
      expect(typeof event!.newWeight).toBe('number');
      expect(event!.oldWeight).toBeGreaterThan(0);
    });
  });

  describe('Event Listeners', () => {
    it('on() returns unsubscribe function', () => {
      const unsubscribe = scheduler.on(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('listener receives events on access', async () => {
      const events: string[] = [];
      scheduler.on(event => events.push(event.nodeId));

      const unit = createMockMemoryUnit('listener-node');
      l2Graph.insert(unit);

      await scheduler.onAccess('listener-node');

      expect(events).toContain('listener-node');
    });

    it('unsubscribe removes listener', async () => {
      const events: string[] = [];
      const unsubscribe = scheduler.on(event => events.push(event.nodeId));

      const unit = createMockMemoryUnit('unsub-node');
      l2Graph.insert(unit);

      await scheduler.onAccess('unsub-node');
      const countBefore = events.length;

      // Unsubscribe
      unsubscribe();

      await scheduler.onAccess('unsub-node');
      expect(events.length).toBe(countBefore); // No new events
    });
  });

  describe('Stats Tracking', () => {
    it('initial stats are zero', () => {
      const stats = scheduler.getStats();
      expect(stats.totalTicks).toBe(0);
      expect(stats.nodesPruned).toBe(0);
      expect(stats.accessDecayEvents).toBe(0);
      expect(stats.isRunning).toBe(false);
    });

    it('isRunning reflects start/stop state', () => {
      const bgScheduler = createDecayScheduler(l2Graph, {
        backgroundTickEnabled: true,
        tickIntervalMs: 10000
      });

      expect(bgScheduler.getStats().isRunning).toBe(false);

      bgScheduler.start();
      expect(bgScheduler.getStats().isRunning).toBe(true);

      bgScheduler.stop();
      expect(bgScheduler.getStats().isRunning).toBe(false);
    });

    it('start() is no-op when backgroundTickEnabled is false', () => {
      scheduler.start();
      expect(scheduler.getStats().isRunning).toBe(false);
    });

    it('stop() is safe to call multiple times', () => {
      scheduler.stop();
      scheduler.stop();
      expect(scheduler.getStats().isRunning).toBe(false);
    });
  });

  describe('Background Tick Mode', () => {
    it('start() sets isRunning when enabled', () => {
      const bgScheduler = createDecayScheduler(l2Graph, {
        backgroundTickEnabled: true,
        tickIntervalMs: 1000
      });

      bgScheduler.start();
      expect(bgScheduler.getStats().isRunning).toBe(true);
      bgScheduler.stop();
    });

    it('start() is idempotent', () => {
      const bgScheduler = createDecayScheduler(l2Graph, {
        backgroundTickEnabled: true,
        tickIntervalMs: 1000
      });

      bgScheduler.start();
      bgScheduler.start(); // Should not create duplicate timers
      expect(bgScheduler.getStats().isRunning).toBe(true);
      bgScheduler.stop();
    });
  });
});
