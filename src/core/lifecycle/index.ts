/**
 * Lifecycle Module Entry Point
 * 5-Phase Metabolic Lifecycle orchestration
 */

export * from './types';
export * from './trace';
export * from './orchestrator';

// Phase implementations
export * from './phases/grounding';
export * from './phases/semantic-pause';
export * from './phases/active-flow';
export * from './phases/detachment';
export * from './phases/rem-synthesis';
