/**
 * Graph Traversal Algorithms
 * BFS/DFS with CMHL decay-weighted exploration
 */

import type {
  GraphNode,
  GraphEdge,
  TraversalResult,
  TraversalOptions,
  DEFAULT_TRAVERSAL_OPTIONS
} from './types';
import { getDecayedWeight, getOtherNodeId } from './edge';
import { recordAccess } from './node';
import { now } from '../../lib/utils/time';

/**
 * Graph store interface for traversal
 */
interface GraphStore {
  getNode(uorId: string): GraphNode | null;
  getEdge(edgeId: string): GraphEdge | null;
}

/**
 * BFS traversal from a starting node with decay-weighted exploration
 */
export function traverseBFS(
  startId: string,
  store: GraphStore,
  options: TraversalOptions = { ...DEFAULT_TRAVERSAL_OPTIONS }
): TraversalResult {
  const visited = new Set<string>();
  const result: GraphNode[] = [];
  const traversedEdges: GraphEdge[] = [];
  const scores = new Map<string, number>();
  const currentTime = now();

  // Queue: [nodeId, depth, cumulativeScore]
  const queue: Array<[string, number, number]> = [[startId, 0, 1.0]];

  while (queue.length > 0 && result.length < options.maxNodes) {
    const [nodeId, depth, parentScore] = queue.shift()!;

    if (visited.has(nodeId)) continue;
    if (depth > options.maxDepth) continue;

    const node = store.getNode(nodeId);
    if (!node) continue;

    visited.add(nodeId);
    result.push(recordAccess(node));
    scores.set(nodeId, parentScore);

    // Explore edges
    for (const edgeId of node.edgeIds) {
      const edge = store.getEdge(edgeId);
      if (!edge) continue;

      // Filter by edge type if specified
      if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) {
        continue;
      }

      // Get decayed weight
      const weight = options.applyDecay
        ? getDecayedWeight(edge, currentTime)
        : edge.weight;

      if (weight < options.minWeight) continue;

      const neighborId = getOtherNodeId(edge, nodeId);
      if (!neighborId || visited.has(neighborId)) continue;

      traversedEdges.push(edge);
      const newScore = parentScore * weight;
      queue.push([neighborId, depth + 1, newScore]);
    }
  }

  return {
    nodes: result,
    edges: traversedEdges,
    depth: Math.max(...Array.from(result).map((_, i) => i), 0),
    scores
  };
}

/**
 * DFS traversal with decay-weighted path scoring
 */
export function traverseDFS(
  startId: string,
  store: GraphStore,
  options: TraversalOptions = { ...DEFAULT_TRAVERSAL_OPTIONS }
): TraversalResult {
  const visited = new Set<string>();
  const result: GraphNode[] = [];
  const traversedEdges: GraphEdge[] = [];
  const scores = new Map<string, number>();
  const currentTime = now();

  function dfs(nodeId: string, depth: number, score: number): void {
    if (visited.has(nodeId)) return;
    if (depth > options.maxDepth) return;
    if (result.length >= options.maxNodes) return;

    const node = store.getNode(nodeId);
    if (!node) return;

    visited.add(nodeId);
    result.push(recordAccess(node));
    scores.set(nodeId, score);

    // Sort edges by decayed weight for best-first exploration
    const edges = node.edgeIds
      .map(id => store.getEdge(id))
      .filter((e): e is GraphEdge => e !== null)
      .filter(e => !options.edgeTypes || options.edgeTypes.includes(e.type))
      .map(e => ({
        edge: e,
        weight: options.applyDecay ? getDecayedWeight(e, currentTime) : e.weight
      }))
      .filter(e => e.weight >= options.minWeight)
      .sort((a, b) => b.weight - a.weight);

    for (const { edge, weight } of edges) {
      const neighborId = getOtherNodeId(edge, nodeId);
      if (!neighborId || visited.has(neighborId)) continue;

      traversedEdges.push(edge);
      dfs(neighborId, depth + 1, score * weight);
    }
  }

  dfs(startId, 0, 1.0);

  return {
    nodes: result,
    edges: traversedEdges,
    depth: options.maxDepth,
    scores
  };
}

/**
 * Find path between two nodes using BFS
 */
export function findPath(
  startId: string,
  endId: string,
  store: GraphStore,
  maxDepth: number = 5
): GraphNode[] | null {
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: Array<[string, number]> = [[startId, 0]];

  while (queue.length > 0) {
    const [nodeId, depth] = queue.shift()!;

    if (nodeId === endId) {
      // Reconstruct path
      const path: GraphNode[] = [];
      let current: string | undefined = endId;

      while (current) {
        const node = store.getNode(current);
        if (node) path.unshift(node);
        current = parent.get(current);
      }

      return path;
    }

    if (visited.has(nodeId) || depth >= maxDepth) continue;
    visited.add(nodeId);

    const node = store.getNode(nodeId);
    if (!node) continue;

    for (const edgeId of node.edgeIds) {
      const edge = store.getEdge(edgeId);
      if (!edge) continue;

      const neighborId = getOtherNodeId(edge, nodeId);
      if (!neighborId || visited.has(neighborId)) continue;

      parent.set(neighborId, nodeId);
      queue.push([neighborId, depth + 1]);
    }
  }

  return null;
}
