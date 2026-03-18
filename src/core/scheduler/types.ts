/**
 * Scheduler Types
 * Hybrid decay scheduler configuration and events
 */

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Enable background tick (can be disabled for resource-constrained) */
  backgroundTickEnabled: boolean;
  /** Tick interval when background is enabled (ms) */
  tickIntervalMs: number;
  /** Min nodes before consolidation runs */
  consolidationThreshold: number;
  /** Decay weight below which to prune */
  pruneThreshold: number;
  /** Enable event-driven decay on access */
  accessDecayEnabled: boolean;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  backgroundTickEnabled: true,
  tickIntervalMs: 60000, // 1 minute
  consolidationThreshold: 100,
  pruneThreshold: 0.01,
  accessDecayEnabled: true
};

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  /** Timestamp of last tick */
  lastTickAt: number;
  /** Total ticks executed */
  totalTicks: number;
  /** Total nodes pruned across all ticks */
  nodesPruned: number;
  /** Total nodes consolidated */
  nodesConsolidated: number;
  /** Count of event-driven decays */
  accessDecayEvents: number;
  /** Whether scheduler is running */
  isRunning: boolean;
}

/**
 * Create initial stats
 */
export function createInitialStats(): SchedulerStats {
  return {
    lastTickAt: 0,
    totalTicks: 0,
    nodesPruned: 0,
    nodesConsolidated: 0,
    accessDecayEvents: 0,
    isRunning: false
  };
}

/**
 * Decay event (emitted on decay/prune)
 */
export interface DecayEvent {
  /** Event trigger type */
  type: 'ACCESS' | 'TICK';
  /** Node that decayed */
  nodeId: string;
  /** Weight before decay */
  oldWeight: number;
  /** Weight after decay */
  newWeight: number;
  /** Whether node was pruned */
  pruned: boolean;
  /** Timestamp */
  timestamp: number;
}

/**
 * Decay event listener
 */
export type DecayEventListener = (event: DecayEvent) => void;
