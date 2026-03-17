/**
 * Graph Consolidation and Pruning
 * Memory graph maintenance during REM synthesis
 */

import type {
  GraphNode,
  GraphEdge,
  ConsolidationResult,
  EdgeType
} from './types';
import { isStableForCrystallization } from './node';
import { isEdgeAlive, createEdge } from './edge';
import { computeDecay } from '../memory/decay';
import { now } from '../../lib/utils/time';

/**
 * Configuration for consolidation process
 */
export interface ConsolidationConfig {
  /** Edge weight threshold for pruning */
  edgePruneThreshold: number;
  /** Node access count for crystallization */
  crystallizationAccessThreshold: number;
  /** Minimum age for crystallization (ms) */
  crystallizationMinAge: number;
  /** Decay threshold for node removal */
  nodePruneDecayThreshold: number;
}

export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  edgePruneThreshold: 0.01,
  crystallizationAccessThreshold: 10,
  crystallizationMinAge: 86400000, // 24 hours
  nodePruneDecayThreshold: 0.001
};

/**
 * Graph store interface for consolidation
 */
interface MutableGraphStore {
  getAllNodes(): GraphNode[];
  getAllEdges(): GraphEdge[];
  removeNode(uorId: string): void;
  removeEdge(edgeId: string): void;
  updateNode(node: GraphNode): void;
}

/**
 * Identify nodes ready for crystallization (L2 → L3 promotion)
 */
export function findCrystallizationCandidates(
  nodes: GraphNode[],
  config: ConsolidationConfig = DEFAULT_CONSOLIDATION_CONFIG
): GraphNode[] {
  return nodes.filter(node =>
    node.tier === 'L2' &&
    isStableForCrystallization(
      node,
      config.crystallizationAccessThreshold,
      config.crystallizationMinAge
    )
  );
}

/**
 * Identify edges that have decayed below threshold
 */
export function findDeadEdges(
  edges: GraphEdge[],
  threshold: number = DEFAULT_CONSOLIDATION_CONFIG.edgePruneThreshold
): GraphEdge[] {
  return edges.filter(edge => !isEdgeAlive(edge, threshold));
}

/**
 * Identify nodes that have fully decayed and can be removed
 */
export function findDeadNodes(
  nodes: GraphNode[],
  threshold: number = DEFAULT_CONSOLIDATION_CONFIG.nodePruneDecayThreshold
): GraphNode[] {
  const currentTime = now();

  return nodes.filter(node => {
    // Never prune L3 nodes
    if (node.tier === 'L3') return false;

    const currentWeight = computeDecay(
      node.decay.w0,
      node.decay.lambda,
      node.decay.t0,
      currentTime
    );

    return currentWeight < threshold;
  });
}

/**
 * Find isolated nodes (no edges)
 */
export function findOrphanNodes(nodes: GraphNode[]): GraphNode[] {
  return nodes.filter(
    node => node.edgeIds.length === 0 && node.tier !== 'L3'
  );
}

/**
 * Execute full consolidation pass
 */
export function consolidate(
  store: MutableGraphStore,
  config: ConsolidationConfig = DEFAULT_CONSOLIDATION_CONFIG
): ConsolidationResult {
  const result: ConsolidationResult = {
    prunedNodes: [],
    prunedEdges: [],
    crystallizedNodes: [],
    newEdges: []
  };

  const nodes = store.getAllNodes();
  const edges = store.getAllEdges();

  // 1. Prune dead edges
  const deadEdges = findDeadEdges(edges, config.edgePruneThreshold);
  for (const edge of deadEdges) {
    store.removeEdge(edge.id);
    result.prunedEdges.push(edge.id);
  }

  // 2. Identify crystallization candidates
  const candidates = findCrystallizationCandidates(nodes, config);
  for (const node of candidates) {
    result.crystallizedNodes.push(node.uorId);
  }

  // 3. Prune dead nodes
  const deadNodes = findDeadNodes(nodes, config.nodePruneDecayThreshold);
  for (const node of deadNodes) {
    store.removeNode(node.uorId);
    result.prunedNodes.push(node.uorId);
  }

  // 4. Prune orphan nodes (after edge pruning)
  const remainingNodes = store.getAllNodes();
  const orphans = findOrphanNodes(remainingNodes);
  for (const orphan of orphans) {
    // Only prune orphans that are also low-access
    if (orphan.accessCount < config.crystallizationAccessThreshold) {
      store.removeNode(orphan.uorId);
      result.prunedNodes.push(orphan.uorId);
    }
  }

  return result;
}

/**
 * Merge similar nodes into a single consolidated node
 * (For future implementation - returns empty for now)
 */
export function mergeNodes(
  _nodes: GraphNode[],
  _similarityThreshold: number = 0.95
): { merged: GraphNode; sources: string[] } | null {
  // Placeholder for future implementation
  // Would merge highly similar nodes into a single representation
  return null;
}
