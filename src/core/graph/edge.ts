/**
 * Graph Edge Operations
 * Decay-weighted semantic relationships
 */

import type { GraphEdge, EdgeType } from './types';
import { now } from '../../lib/utils/time';
import { sha256 } from '../../lib/utils/hash';
import { computeDecay } from '../memory/decay';

/** Default edge decay rate */
const DEFAULT_EDGE_LAMBDA = 0.01;

/**
 * Generate a unique edge ID from source and target
 */
export function generateEdgeId(
  sourceId: string,
  targetId: string,
  type: EdgeType
): string {
  const input = `${sourceId}:${targetId}:${type}`;
  return sha256(input).slice(0, 16);
}

/**
 * Create a new edge between two nodes
 */
export function createEdge(
  sourceId: string,
  targetId: string,
  type: EdgeType,
  weight: number = 1.0,
  lambda: number = DEFAULT_EDGE_LAMBDA
): GraphEdge {
  const id = generateEdgeId(sourceId, targetId, type);

  return {
    id,
    sourceId,
    targetId,
    type,
    weight,
    createdAt: now(),
    lambda
  };
}

/**
 * Compute current edge weight with decay applied
 */
export function getDecayedWeight(edge: GraphEdge, currentTime?: number): number {
  const t = currentTime ?? now();
  return computeDecay(edge.weight, edge.lambda, edge.createdAt, t);
}

/**
 * Check if edge weight is above threshold
 */
export function isEdgeAlive(
  edge: GraphEdge,
  threshold: number = 0.01
): boolean {
  return getDecayedWeight(edge) >= threshold;
}

/**
 * Strengthen an edge (increase weight)
 */
export function strengthenEdge(
  edge: GraphEdge,
  amount: number = 0.1
): GraphEdge {
  return {
    ...edge,
    weight: Math.min(1.0, edge.weight + amount)
  };
}

/**
 * Get the other node in an edge given one node ID
 */
export function getOtherNodeId(edge: GraphEdge, nodeId: string): string | null {
  if (edge.sourceId === nodeId) return edge.targetId;
  if (edge.targetId === nodeId) return edge.sourceId;
  return null;
}

/**
 * Check if edge connects two specific nodes
 */
export function edgeConnects(
  edge: GraphEdge,
  nodeId1: string,
  nodeId2: string
): boolean {
  return (
    (edge.sourceId === nodeId1 && edge.targetId === nodeId2) ||
    (edge.sourceId === nodeId2 && edge.targetId === nodeId1)
  );
}

/**
 * Create edges from similarity scores
 */
export function createEdgesFromSimilarities(
  sourceId: string,
  similarities: Array<{ targetId: string; score: number }>,
  type: EdgeType = 'SEMANTIC',
  minScore: number = 0.3
): GraphEdge[] {
  return similarities
    .filter(s => s.score >= minScore && s.targetId !== sourceId)
    .map(s => createEdge(sourceId, s.targetId, type, s.score));
}
