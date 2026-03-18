/**
 * Decay Scheduler
 * Hybrid event-driven + background tick decay management
 */

import type { L2GraphStore } from '../tiers/l2-graph';
import type { GraphNode } from '../graph/types';
import { computeDecay } from '../memory/decay';
import { now } from '../../lib/utils/time';
import type {
  SchedulerConfig,
  SchedulerStats,
  DecayEvent,
  DecayEventListener
} from './types';
import { DEFAULT_SCHEDULER_CONFIG, createInitialStats } from './types';

/**
 * Hybrid decay scheduler implementation
 */
export class DecayScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private stats: SchedulerStats;
  private listeners: DecayEventListener[] = [];
  private l2Graph: L2GraphStore;
  private config: SchedulerConfig;

  constructor(
    l2Graph: L2GraphStore,
    config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG
  ) {
    this.l2Graph = l2Graph;
    this.config = config;
    this.stats = createInitialStats();
  }

  /**
   * Start background tick (if enabled)
   */
  start(): void {
    if (!this.config.backgroundTickEnabled) return;
    if (this.timer !== null) return;

    this.stats.isRunning = true;
    this.timer = setInterval(
      () => this.tick(),
      this.config.tickIntervalMs
    );
  }

  /**
   * Stop background tick
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stats.isRunning = false;
  }

  /**
   * Manual tick for testing or on-demand pruning
   */
  async tick(): Promise<SchedulerStats> {
    const currentTime = now();
    await this.runDecayPass(currentTime);

    this.stats.lastTickAt = currentTime;
    this.stats.totalTicks++;

    return { ...this.stats };
  }

  /**
   * Called on node access - event-driven decay
   */
  async onAccess(nodeId: string): Promise<DecayEvent | null> {
    if (!this.config.accessDecayEnabled) return null;

    const node = this.l2Graph.getNode(nodeId);
    if (!node) return null;

    const currentTime = now();
    const oldWeight = node.decay.w0;
    const newWeight = this.computeNodeDecay(node, currentTime);

    const pruned = newWeight < this.config.pruneThreshold;

    const event: DecayEvent = {
      type: 'ACCESS',
      nodeId,
      oldWeight,
      newWeight,
      pruned,
      timestamp: currentTime
    };

    if (pruned) {
      this.l2Graph.removeNode(nodeId);
      this.stats.nodesPruned++;
    }

    this.stats.accessDecayEvents++;
    this.emit(event);

    return event;
  }

  /**
   * Subscribe to decay events
   */
  on(listener: DecayEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get current stats
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Get current config
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update config (restarts timer if interval changed)
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    const wasRunning = this.stats.isRunning;
    const oldInterval = this.config.tickIntervalMs;

    this.config = { ...this.config, ...config };

    // Restart if interval changed and was running
    if (wasRunning && config.tickIntervalMs !== undefined &&
        config.tickIntervalMs !== oldInterval) {
      this.stop();
      this.start();
    }
  }

  /**
   * Run decay pass on all nodes
   */
  private async runDecayPass(currentTime: number): Promise<void> {
    const nodes = this.l2Graph.getAllNodes();
    const toPrune: string[] = [];

    for (const node of nodes) {
      const oldWeight = node.decay.w0;
      const newWeight = this.computeNodeDecay(node, currentTime);

      if (newWeight < this.config.pruneThreshold) {
        toPrune.push(node.uorId);

        const event: DecayEvent = {
          type: 'TICK',
          nodeId: node.uorId,
          oldWeight,
          newWeight,
          pruned: true,
          timestamp: currentTime
        };

        this.emit(event);
      }
    }

    // Prune dead nodes
    for (const nodeId of toPrune) {
      this.l2Graph.removeNode(nodeId);
    }

    this.stats.nodesPruned += toPrune.length;

    // Run consolidation if threshold met
    const size = this.l2Graph.size();
    if (size.nodes >= this.config.consolidationThreshold) {
      const result = this.l2Graph.consolidate();
      this.stats.nodesConsolidated += result.mergedNodes;
    }
  }

  /**
   * Compute decayed weight for a node
   */
  private computeNodeDecay(node: GraphNode, currentTime: number): number {
    return computeDecay(
      node.decay.w0,
      node.decay.lambda,
      node.lastAccessedAt,
      currentTime
    );
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: DecayEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Create decay scheduler instance
 */
export function createDecayScheduler(
  l2Graph: L2GraphStore,
  config?: Partial<SchedulerConfig>
): DecayScheduler {
  return new DecayScheduler(l2Graph, { ...DEFAULT_SCHEDULER_CONFIG, ...config });
}
