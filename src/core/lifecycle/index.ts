/**
 * Lifecycle Module Entry Point
 * 5-Phase Metabolic Lifecycle orchestration
 */

export * from './types.js';
export * from './trace.js';
export * from './orchestrator.js';

// Phase implementations
export * from './phases/grounding.js';
export * from './phases/semantic-pause.js';
export * from './phases/active-flow.js';
export * from './phases/detachment.js';
export * from './phases/rem-synthesis.js';
