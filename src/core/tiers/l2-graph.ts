/**
 * L2 Temporal Graph Store
 * Graph-based memory with CMHL decay and edge traversal
 */

import type { MemoryUnit } from '../memory/types';
import type {
  GraphNode,
  GraphEdge,
  TraversalResult,
  TraversalOptions,
  EdgeType
} from '../graph/types';
import { createNode, recordAccess, isStableForCrystallization } from '../graph/node';
import { createEdge, createEdgesFromSimilarities, getDecayedWeight } from '../graph/edge';
import { traverseBFS } from '../graph/traversal';
import { consolidate, type ConsolidationResult, type ConsolidationConfig } from '../graph/consolidation';
import { cosineSimilarity } from '../memory/decoder';
import { now } from '../../lib/utils/time';

/**
 * L2 Graph Store configuration
 */
export interface L2GraphConfig {
  /** Minimum similarity for auto-edge creation */
  autoEdgeThreshold: number;
  /** Maximum edges per node */
  maxEdgesPerNode: number;
  /** Default traversal depth */
  defaultTraversalDepth: number;
}

export const DEFAULT_L2_CONFIG: L2GraphConfig = {
  autoEdgeThreshold: 0.5,
  maxEdgesPerNode: 20,
  defaultTraversalDepth: 3
};

/**
 * L2 Temporal Graph Store implementation
 */
export class L2GraphStore {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private config: L2GraphConfig;

  constructor(config: L2GraphConfig = DEFAULT_L2_CONFIG) {
    this.config = config;
  }

  /**
   * Insert a memory unit as a graph node
   */
  insert(unit: MemoryUnit): GraphNode {
    const node = createNode(unit, 'L2');
    this.nodes.set(node.uorId, node);

    // Create edges to similar existing nodes
    this.createAutoEdges(node);

    return node;
  }

  /**
   * Create edges to similar nodes automatically
   */
  private createAutoEdges(newNode: GraphNode): void {
    const similarities: Array<{ targetId: string; score: number }> = [];

    for (const [id, existingNode] of this.nodes.entries()) {
      if (id === newNode.uorId) continue;

      const score = cosineSimilarity(newNode.embedding, existingNode.embedding);
      if (score >= this.config.autoEdgeThreshold) {
        similarities.push({ targetId: id, score });
      }
    }

    // Sort by score and limit edges
    similarities.sort((a, b) => b.score - a.score);
    const topSimilarities = similarities.slice(0, this.config.maxEdgesPerNode);

    const newEdges = createEdgesFromSimilarities(
      newNode.uorId,
      topSimilarities,
      'SEMANTIC',
      this.config.autoEdgeThreshold
    );

    for (const edge of newEdges) {
      this.addEdge(edge);
    }
  }

  /**
   * Add an edge and update node references
   */
  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);

    // Update source node
    const sourceNode = this.nodes.get(edge.sourceId);
    if (sourceNode && !sourceNode.edgeIds.includes(edge.id)) {
      this.nodes.set(edge.sourceId, {
        ...sourceNode,
        edgeIds: [...sourceNode.edgeIds, edge.id]
      });
    }

    // Update target node
    const targetNode = this.nodes.get(edge.targetId);
    if (targetNode && !targetNode.edgeIds.includes(edge.id)) {
      this.nodes.set(edge.targetId, {
        ...targetNode,
        edgeIds: [...targetNode.edgeIds, edge.id]
      });
    }
  }

  /**
   * Get node by UOR ID
   */
  getNode(uorId: string): GraphNode | null {
    return this.nodes.get(uorId) ?? null;
  }

  /**
   * Get edge by ID
   */
  getEdge(edgeId: string): GraphEdge | null {
    return this.edges.get(edgeId) ?? null;
  }

  /**
   * Access a node (updates timestamps)
   */
  access(uorId: string): GraphNode | null {
    const node = this.nodes.get(uorId);
    if (!node) return null;

    const updated = recordAccess(node);
    this.nodes.set(uorId, updated);
    return updated;
  }

  /**
   * Traverse graph from a starting node
   */
  traverse(
    startId: string,
    options?: Partial<TraversalOptions>
  ): TraversalResult {
    const fullOptions: TraversalOptions = {
      maxDepth: options?.maxDepth ?? this.config.defaultTraversalDepth,
      minWeight: options?.minWeight ?? 0.1,
      maxNodes: options?.maxNodes ?? 50,
      applyDecay: options?.applyDecay ?? true,
      edgeTypes: options?.edgeTypes
    };

    return traverseBFS(startId, this, fullOptions);
  }

  /**
   * Find nodes similar to a query embedding
   */
  findSimilar(
    queryEmbedding: Float32Array,
    k: number = 10
  ): GraphNode[] {
    const scored: Array<{ node: GraphNode; score: number }> = [];

    for (const node of this.nodes.values()) {
      const score = cosineSimilarity(queryEmbedding, node.embedding);
      scored.push({ node, score });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => s.node);
  }

  /**
   * Find stable nodes ready for crystallization
   */
  findStableNodes(
    accessThreshold: number = 10,
    minAgeMs: number = 86400000
  ): GraphNode[] {
    const stable: GraphNode[] = [];

    for (const node of this.nodes.values()) {
      if (isStableForCrystallization(node, accessThreshold, minAgeMs)) {
        stable.push(node);
      }
    }

    return stable;
  }

  /**
   * Remove a node and its edges
   */
  removeNode(uorId: string): void {
    const node = this.nodes.get(uorId);
    if (!node) return;

    // Remove associated edges
    for (const edgeId of node.edgeIds) {
      this.edges.delete(edgeId);
    }

    this.nodes.delete(uorId);
  }

  /**
   * Remove an edge
   */
  removeEdge(edgeId: string): void {
    this.edges.delete(edgeId);
  }

  /**
   * Update a node
   */
  updateNode(node: GraphNode): void {
    this.nodes.set(node.uorId, node);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges
   */
  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Run consolidation pass
   */
  consolidate(config?: ConsolidationConfig): ConsolidationResult {
    return consolidate(this, config);
  }

  /**
   * Create a checkpoint for the current state
   */
  checkpoint(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges()
    };
  }

  /**
   * Get store size
   */
  size(): { nodes: number; edges: number } {
    return {
      nodes: this.nodes.size,
      edges: this.edges.size
    };
  }

  /**
   * Clear the store
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }
}

/**
 * Create a new L2 graph store instance
 */
export function createL2GraphStore(config?: L2GraphConfig): L2GraphStore {
  return new L2GraphStore(config);
}
