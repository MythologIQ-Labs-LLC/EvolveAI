use crate::memory::types::{MemoryUnit, UorAddress};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A weighted, timestamped edge between two memory nodes.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Edge {
    pub target: UorAddress,
    pub weight: f32,
    pub created_at: i64,
}

/// L2 Temporal Graph -- associative memory with weighted edges.
pub struct L2Graph {
    nodes: HashMap<UorAddress, MemoryUnit>,
    edges: HashMap<UorAddress, Vec<Edge>>,
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
        let addr = unit.address.clone();
        self.nodes.insert(addr.clone(), unit);
        self.edges.entry(addr).or_default();
    }

    /// Add an edge between two existing nodes.
    pub fn add_edge(&mut self, from: UorAddress, to: UorAddress, weight: f32, now: i64) {
        if !self.nodes.contains_key(&from) || !self.nodes.contains_key(&to) {
            return;
        }
        let edges = self.edges.entry(from).or_default();
        edges.push(Edge { target: to, weight, created_at: now });
    }

    /// Get a node by address.
    pub fn get(&self, addr: &UorAddress) -> Option<&MemoryUnit> {
        self.nodes.get(addr)
    }

    /// Get a mutable reference to a node by address.
    pub fn get_mut(&mut self, addr: &UorAddress) -> Option<&mut MemoryUnit> {
        self.nodes.get_mut(addr)
    }

    /// Get outgoing edges from a node.
    pub fn edges_from(&self, addr: &UorAddress) -> &[Edge] {
        self.edges.get(addr).map_or(&[], Vec::as_slice)
    }

    /// Get direct neighbors of a node (depth 1).
    pub fn neighbors(&self, addr: &UorAddress) -> Vec<&MemoryUnit> {
        self.edges_from(addr)
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
    pub fn remove(&mut self, addr: &UorAddress) -> Option<MemoryUnit> {
        self.edges.remove(addr);
        for edges in self.edges.values_mut() {
            edges.retain(|e| e.target != *addr);
        }
        self.nodes.remove(addr)
    }

    /// Get all nodes as a vec (for snapshotting).
    pub fn nodes_vec(&self) -> Vec<MemoryUnit> {
        self.nodes.values().cloned().collect()
    }

    /// Get edges map reference (for snapshotting).
    pub fn edges_map(&self) -> &HashMap<UorAddress, Vec<Edge>> {
        &self.edges
    }

    /// Link a new node to all session peers in this graph.
    /// Edge weight: 1.0 / (1.0 + gap_ms / 1000.0) — closer in time = stronger.
    pub fn link_to_session(
        &mut self,
        new_addr: &UorAddress,
        session: &[(UorAddress, i64)],
        now: i64,
    ) {
        for (peer_addr, peer_time) in session {
            if !self.nodes.contains_key(peer_addr) {
                continue;
            }
            let gap_ms = (now - peer_time).unsigned_abs() as f32;
            let weight = 1.0 / (1.0 + gap_ms / 1000.0);
            if weight < 0.05 {
                continue; // Skip distant links — bounds O(K²) edge growth
            }
            self.add_edge(new_addr.clone(), peer_addr.clone(), weight, now);
            self.add_edge(peer_addr.clone(), new_addr.clone(), weight, now);
        }
    }

    /// Reconstruct from parts.
    pub fn from_parts(nodes: Vec<MemoryUnit>, edges: HashMap<UorAddress, Vec<Edge>>) -> Self {
        let node_map = nodes.into_iter().map(|u| (u.address.clone(), u)).collect();
        Self { nodes: node_map, edges }
    }
}

impl Default for L2Graph {
    fn default() -> Self {
        Self::new()
    }
}
