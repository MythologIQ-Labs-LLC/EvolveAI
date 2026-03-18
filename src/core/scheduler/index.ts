/**
 * Scheduler Module
 * Hybrid decay scheduler for proactive memory management
 */

// Types
export type {
  SchedulerConfig,
  SchedulerStats,
  DecayEvent,
  DecayEventListener
} from './types';

export {
  DEFAULT_SCHEDULER_CONFIG,
  createInitialStats
} from './types';

// Scheduler implementation
export {
  DecayScheduler,
  createDecayScheduler
} from './decay-scheduler';
