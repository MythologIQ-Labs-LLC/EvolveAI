/**
 * Graph Node Operations
 * Memory node creation and management
 */

import type { GraphNode, EdgeType } from './types';
import type { Tier, DecayParams, MemoryUnit } from '../memory/types';
import { now } from '../../lib/utils/time';
import { DEFAULT_DECAY_CONFIG } from '../memory/decay';

/**
 * Create a new graph node from a memory unit
 */
export function createNode(
  unit: MemoryUnit,
  tier: Tier = 'L2'
): GraphNode {
  const timestamp = now();
  const lambda = DEFAULT_DECAY_CONFIG.defaultLambda[tier];

  return {
    uorId: unit.uor_id,
    embedding: unit.embedding,
    tier,
    createdAt: timestamp,
    lastAccessedAt: timestamp,
    accessCount: 1,
    decay: {
      w0: 1.0,
      lambda,
      t0: timestamp
    },
    edgeIds: [],
    metadata: unit.metadata ? { ...unit.metadata } : undefined
  };
}

/**
 * Record an access to a node (updates timestamps and counts)
 */
export function recordAccess(node: GraphNode): GraphNode {
  return {
    ...node,
    lastAccessedAt: now(),
    accessCount: node.accessCount + 1
  };
}

/**
 * Add an edge ID to a node
 */
export function addEdgeToNode(node: GraphNode, edgeId: string): GraphNode {
  if (node.edgeIds.includes(edgeId)) {
    return node;
  }
  return {
    ...node,
    edgeIds: [...node.edgeIds, edgeId]
  };
}

/**
 * Remove an edge ID from a node
 */
export function removeEdgeFromNode(node: GraphNode, edgeId: string): GraphNode {
  return {
    ...node,
    edgeIds: node.edgeIds.filter(id => id !== edgeId)
  };
}

/**
 * Check if node is stable enough for crystallization
 * Based on access patterns and time since creation
 */
export function isStableForCrystallization(
  node: GraphNode,
  stabilityThreshold: number = 10,
  minAgeMs: number = 86400000 // 24 hours
): boolean {
  const age = now() - node.createdAt;
  return node.accessCount >= stabilityThreshold && age >= minAgeMs;
}

/**
 * Update node tier assignment
 */
export function updateNodeTier(node: GraphNode, newTier: Tier): GraphNode {
  const lambda = DEFAULT_DECAY_CONFIG.defaultLambda[newTier];
  return {
    ...node,
    tier: newTier,
    decay: {
      ...node.decay,
      lambda
    }
  };
}

/**
 * Calculate node degree (number of connections)
 */
export function getNodeDegree(node: GraphNode): number {
  return node.edgeIds.length;
}

/**
 * Check if two nodes are connected by edge ID
 */
export function areNodesConnected(
  node: GraphNode,
  edgeIds: Set<string>
): boolean {
  return node.edgeIds.some(id => edgeIds.has(id));
}
