/**
 * Graph Type Definitions
 * L2 Temporal Graph structures with decay-weighted edges
 */

import type { Tier, DecayParams } from '../memory/types';

/**
 * Semantic relationship types between memory nodes
 */
export type EdgeType =
  | 'SEMANTIC'      // Content similarity
  | 'TEMPORAL'      // Time-based sequence
  | 'CAUSAL'        // Cause-effect relationship
  | 'REFERENCE'     // Explicit reference
  | 'DERIVED';      // Computed/inferred relationship

/**
 * A node in the memory graph
 */
export interface GraphNode {
  /** UOR identifier (content-addressed) */
  uorId: string;
  /** Semantic embedding vector */
  embedding: Float32Array;
  /** Current tier assignment */
  tier: Tier;
  /** Node creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessedAt: number;
  /** Access count for stability calculation */
  accessCount: number;
  /** Decay parameters for this node */
  decay: DecayParams;
  /** Adjacent edge IDs */
  edgeIds: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * An edge connecting two nodes with decay weight
 */
export interface GraphEdge {
  /** Unique edge identifier */
  id: string;
  /** Source node UOR ID */
  sourceId: string;
  /** Target node UOR ID */
  targetId: string;
  /** Relationship type */
  type: EdgeType;
  /** Initial edge weight */
  weight: number;
  /** Edge creation timestamp */
  createdAt: number;
  /** Decay lambda for this edge */
  lambda: number;
}

/**
 * Result of graph traversal
 */
export interface TraversalResult {
  /** Visited nodes in traversal order */
  nodes: GraphNode[];
  /** Edges traversed */
  edges: GraphEdge[];
  /** Total traversal depth reached */
  depth: number;
  /** Decay-adjusted relevance scores */
  scores: Map<string, number>;
}

/**
 * Options for graph traversal
 */
export interface TraversalOptions {
  /** Maximum depth to traverse */
  maxDepth: number;
  /** Minimum edge weight to follow */
  minWeight: number;
  /** Edge types to follow (all if empty) */
  edgeTypes?: EdgeType[];
  /** Maximum nodes to return */
  maxNodes: number;
  /** Whether to apply CMHL decay during traversal */
  applyDecay: boolean;
}

/**
 * Graph consolidation result
 */
export interface ConsolidationResult {
  /** Nodes removed */
  prunedNodes: string[];
  /** Edges removed */
  prunedEdges: string[];
  /** Nodes promoted to L3 */
  crystallizedNodes: string[];
  /** New edges created during consolidation */
  newEdges: string[];
}

/**
 * Default traversal options
 */
export const DEFAULT_TRAVERSAL_OPTIONS: TraversalOptions = {
  maxDepth: 3,
  minWeight: 0.1,
  maxNodes: 50,
  applyDecay: true
};
