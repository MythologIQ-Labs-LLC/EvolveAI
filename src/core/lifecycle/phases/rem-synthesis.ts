/**
 * Phase 5: REM Synthesis
 * Learning phase - extract rules and crystallize stable memories
 */

import type { PipelineTrace } from '../types';
import type { GraphNode } from '../../graph/types';
import type { L2GraphStore } from '../../tiers/l2-graph';
import type { L3Vault } from '../../tiers/l3-vault';
import type { ShadowGenome } from '../../shadow/genome';
import type { MemoryUnit } from '../../memory/types';
import { extractSuccessPatterns, extractFailurePatterns } from '../trace';
import { createFailureTrace } from '../../shadow/failure-types';

/**
 * Synthesis result
 */
export interface SynthesisResult {
  /** Number of successful traces processed */
  successTracesProcessed: number;
  /** Number of failure traces processed */
  failureTracesProcessed: number;
  /** Number of nodes crystallized to L3 */
  crystallized: number;
  /** Number of shadow entries created */
  shadowEntriesCreated: number;
  /** Extracted rules (for future rule engine) */
  extractedRules: ExtractedRule[];
}

/**
 * Extracted rule from trace patterns
 */
export interface ExtractedRule {
  /** Rule identifier */
  id: string;
  /** Operation this rule applies to */
  operation: string;
  /** Condition pattern */
  condition: unknown;
  /** Expected outcome */
  outcome: 'success' | 'failure';
  /** Confidence based on trace count */
  confidence: number;
}

/**
 * Synthesis context
 */
export interface SynthesisContext {
  /** Traces to process */
  traces: PipelineTrace[];
  /** L2 graph for finding stable nodes */
  l2Graph?: L2GraphStore;
  /** L3 vault for crystallization */
  l3Vault?: L3Vault;
  /** Shadow genome for failure learning */
  shadowGenome?: ShadowGenome;
  /** Embedding function for shadow entries */
  embedder?: (text: string) => Promise<Float32Array>;
}

/**
 * Execute REM synthesis phase
 */
export async function executeRemSynthesis(
  context: SynthesisContext
): Promise<SynthesisResult> {
  const result: SynthesisResult = {
    successTracesProcessed: 0,
    failureTracesProcessed: 0,
    crystallized: 0,
    shadowEntriesCreated: 0,
    extractedRules: []
  };

  // Process successful traces
  const successPatterns = extractSuccessPatterns(context.traces);
  result.successTracesProcessed = successPatterns.length;

  // Process failure traces
  const failurePatterns = extractFailurePatterns(context.traces);
  result.failureTracesProcessed = failurePatterns.length;

  // Ingest failures into shadow genome
  if (context.shadowGenome && context.embedder) {
    for (const pattern of failurePatterns) {
      const trace = createFailureTrace(
        'INTEGRATION_FAILURE', // Default category
        pattern.operation,
        pattern.error,
        { input: pattern.input }
      );

      const embedding = await context.embedder(pattern.error);
      await context.shadowGenome.ingest(trace, embedding);
      result.shadowEntriesCreated++;
    }
  }

  // Find and crystallize stable L2 nodes
  if (context.l2Graph && context.l3Vault) {
    const stableNodes = context.l2Graph.findStableNodes();

    for (const node of stableNodes) {
      const unit = nodeToMemoryUnit(node);
      context.l3Vault.crystallize(unit, { sourcePhase: 'REM_SYNTHESIS' });
      context.l2Graph.removeNode(node.uorId);
      result.crystallized++;
    }
  }

  // Extract rules from patterns
  result.extractedRules = extractRules(successPatterns, failurePatterns);

  return result;
}

/**
 * Convert graph node to memory unit for crystallization
 */
function nodeToMemoryUnit(node: GraphNode): MemoryUnit {
  return {
    uor_id: node.uorId,
    content: node.metadata ?? {},
    embedding: node.embedding,
    metadata: {
      tier: 'L3',
      createdAt: node.createdAt,
      lastAccessedAt: node.lastAccessedAt,
      accessCount: node.accessCount,
      tags: ['crystallized']
    }
  };
}

/**
 * Extract rules from trace patterns
 */
function extractRules(
  successPatterns: Array<{ operation: string; input: unknown; output: unknown }>,
  failurePatterns: Array<{ operation: string; input: unknown; error: string }>
): ExtractedRule[] {
  const rules: ExtractedRule[] = [];
  const operationCounts = new Map<string, { success: number; failure: number }>();

  // Count by operation
  for (const p of successPatterns) {
    const counts = operationCounts.get(p.operation) ?? { success: 0, failure: 0 };
    counts.success++;
    operationCounts.set(p.operation, counts);
  }

  for (const p of failurePatterns) {
    const counts = operationCounts.get(p.operation) ?? { success: 0, failure: 0 };
    counts.failure++;
    operationCounts.set(p.operation, counts);
  }

  // Generate rules for operations with clear patterns
  for (const [operation, counts] of operationCounts.entries()) {
    const total = counts.success + counts.failure;
    if (total < 3) continue; // Need minimum data

    const successRate = counts.success / total;

    if (successRate > 0.8) {
      rules.push({
        id: `rule_${operation}_success`,
        operation,
        condition: { minSuccessRate: 0.8 },
        outcome: 'success',
        confidence: successRate
      });
    } else if (successRate < 0.2) {
      rules.push({
        id: `rule_${operation}_failure`,
        operation,
        condition: { maxSuccessRate: 0.2 },
        outcome: 'failure',
        confidence: 1 - successRate
      });
    }
  }

  return rules;
}

/**
 * Clear traces after synthesis
 */
export function clearProcessedTraces(traces: PipelineTrace[]): PipelineTrace[] {
  return [];
}
