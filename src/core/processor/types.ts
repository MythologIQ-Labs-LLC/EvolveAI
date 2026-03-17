/**
 * Neural Net Processor Type Definitions
 * Main facade types for the agentic memory system
 */

import type { MemoryUnit, Query, RecallResult, Phase, RawInput } from '../memory/types';
import type { TierDecision } from '../tiers/types';
import type { SafetyVerdict } from '../shadow/interceptor';
import type { SynthesisResult } from '../lifecycle/phases/rem-synthesis';
import type { IntegrityReport } from '../chain/types';

/**
 * Processor initialization result
 */
export interface ProcessorInitResult {
  /** Whether initialization succeeded */
  success: boolean;
  /** Session ID */
  sessionId: string;
  /** Genesis block hash if vault initialized */
  genesisHash?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Encoding result from processor
 */
export interface EncodeResult {
  /** Created memory unit */
  unit: MemoryUnit;
  /** Tier routing decision */
  tierDecision: TierDecision;
  /** Whether encoding succeeded */
  success: boolean;
  /** Error if failed */
  error?: string;
}

/**
 * Query result from processor
 */
export interface ProcessorQueryResult {
  /** Recall result from memory */
  recall: RecallResult;
  /** Current lifecycle phase */
  phase: Phase;
  /** Query execution time in ms */
  executionTimeMs: number;
  /** Whether query succeeded */
  success: boolean;
  /** Error if failed */
  error?: string;
}

/**
 * Safety check result
 */
export interface SafetyCheckResult {
  /** Whether intent passed */
  passed: boolean;
  /** Full safety verdict */
  verdict: SafetyVerdict;
  /** Current phase */
  phase: Phase;
}

/**
 * Processor statistics
 */
export interface ProcessorStats {
  /** Current lifecycle phase */
  currentPhase: Phase;
  /** Session ID */
  sessionId: string;
  /** L1 cache size */
  l1Size: number;
  /** L2 graph size */
  l2Size: { nodes: number; edges: number };
  /** L3 vault chain length */
  l3ChainLength: number;
  /** Shadow genome size */
  shadowGenomeSize: number;
  /** Total traces in current session */
  traceCount: number;
  /** Uptime in ms */
  uptimeMs: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall health status */
  healthy: boolean;
  /** L3 vault integrity */
  vaultIntegrity: IntegrityReport;
  /** Component status */
  components: {
    lifecycle: boolean;
    l1Cache: boolean;
    l2Graph: boolean;
    l3Vault: boolean;
    shadowGenome: boolean;
  };
}

/**
 * Processor event types
 */
export type ProcessorEvent =
  | { type: 'PHASE_CHANGE'; from: Phase; to: Phase }
  | { type: 'MEMORY_ENCODED'; unitId: string; tier: string }
  | { type: 'MEMORY_CRYSTALLIZED'; unitId: string }
  | { type: 'SAFETY_BLOCK'; reason: string }
  | { type: 'SYNTHESIS_COMPLETE'; result: SynthesisResult }
  | { type: 'ERROR'; error: string };

/**
 * Event listener type
 */
export type ProcessorEventListener = (event: ProcessorEvent) => void;
