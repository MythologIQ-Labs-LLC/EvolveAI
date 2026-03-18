use crate::memory::types::{MemoryUnit, UorId};
use std::collections::HashMap;

/// A weighted, timestamped edge between two memory nodes.
#[derive(Clone, Debug)]
pub struct Edge {
    pub target: UorId,
    pub weight: f32,
    pub created_at: i64,
}

/// L2 Temporal Graph -- associative memory with weighted edges.
pub struct L2Graph {
    nodes: HashMap<UorId, MemoryUnit>,
    edges: HashMap<UorId, Vec<Edge>>,
}

impl L2Graph {
    /// Create an empty graph.
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
        }
    }

    /// Insert a memory node into the graph.
    pub fn insert(&mut self, unit: MemoryUnit) {
        let id = unit.uor_id;
        self.nodes.insert(id, unit);
        self.edges.entry(id).or_default();
    }

    /// Add an edge between two existing nodes.
    pub fn add_edge(&mut self, from: UorId, to: UorId, weight: f32, now: i64) {
        if !self.nodes.contains_key(&from) || !self.nodes.contains_key(&to) {
            return;
        }
        let edges = self.edges.entry(from).or_default();
        edges.push(Edge {
            target: to,
            weight,
            created_at: now,
        });
    }

    /// Get a node by ID.
    pub fn get(&self, id: &UorId) -> Option<&MemoryUnit> {
        self.nodes.get(id)
    }

    /// Get outgoing edges from a node.
    pub fn edges_from(&self, id: &UorId) -> &[Edge] {
        self.edges.get(id).map_or(&[], Vec::as_slice)
    }

    /// Get direct neighbors of a node (depth 1).
    pub fn neighbors(&self, id: &UorId) -> Vec<&MemoryUnit> {
        self.edges_from(id)
            .iter()
            .filter_map(|edge| self.nodes.get(&edge.target))
            .collect()
    }

    /// Iterate over all nodes.
    pub fn iter_units(&self) -> impl Iterator<Item = &MemoryUnit> {
        self.nodes.values()
    }

    /// Total number of nodes.
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    /// Total number of edges.
    pub fn edge_count(&self) -> usize {
        self.edges.values().map(Vec::len).sum()
    }

    /// Remove a node and all edges referencing it.
    pub fn remove(&mut self, id: &UorId) -> Option<MemoryUnit> {
        self.edges.remove(id);
        for edges in self.edges.values_mut() {
            edges.retain(|e| e.target != *id);
        }
        self.nodes.remove(id)
    }
}

impl Default for L2Graph {
    fn default() -> Self {
        Self::new()
    }
}
