use crate::memory::types::MemoryUnit;
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;
use std::collections::HashMap;

/// Aggregated view of the memory system's knowledge state.
#[derive(Clone, Debug)]
pub struct CognitiveProfile {
    pub total_memories: usize,
    pub l1_count: usize,
    pub l2_count: usize,
    pub l3_count: usize,
    pub edge_count: usize,
    pub avg_saturation: f32,
    pub crystallized_count: usize,
    pub top_tags: Vec<(String, usize)>,
}

impl CognitiveProfile {
    /// Human-readable text summary.
    pub fn to_summary(&self) -> String {
        let mut lines = vec![
            format!(
                "Memories: {} total ({} L1, {} L2, {} L3)",
                self.total_memories, self.l1_count, self.l2_count, self.l3_count
            ),
            format!("Associations: {} edges", self.edge_count),
            format!("Avg saturation: {:.1}%", self.avg_saturation * 100.0),
            format!("Crystallized: {} (σ ≥ 0.95)", self.crystallized_count),
        ];
        if !self.top_tags.is_empty() {
            let tags: Vec<String> = self.top_tags.iter()
                .map(|(t, c)| format!("{t} ({c})"))
                .collect();
            lines.push(format!("Top tags: {}", tags.join(", ")));
        }
        lines.join("\n")
    }
}

/// Compute a cognitive profile from the current tier state.
pub fn compute(
    l1: &L1Cache,
    l2: &L2Graph,
    l3: &L3Vault,
    now: i64,
    max_tags: usize,
) -> CognitiveProfile {
    let l1_units: Vec<&MemoryUnit> = l1.iter_units(now).collect();
    let l2_units: Vec<&MemoryUnit> = l2.iter_units().collect();
    let l3_units: Vec<&MemoryUnit> = l3.iter_units().collect();

    let total = l1_units.len() + l2_units.len() + l3_units.len();

    let all: Vec<&MemoryUnit> = l1_units.iter().chain(l2_units.iter()).chain(l3_units.iter())
        .copied().collect();

    let avg_sat = if total > 0 {
        all.iter().map(|u| u.saturation).sum::<f32>() / total as f32
    } else {
        0.0
    };

    CognitiveProfile {
        total_memories: total,
        l1_count: l1_units.len(),
        l2_count: l2_units.len(),
        l3_count: l3_units.len(),
        edge_count: l2.edge_count(),
        avg_saturation: avg_sat,
        crystallized_count: all.iter().filter(|u| u.saturation >= 0.95).count(),
        top_tags: compute_top_tags(&all, max_tags),
    }
}

fn compute_top_tags(units: &[&MemoryUnit], max: usize) -> Vec<(String, usize)> {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for unit in units {
        for tag in &unit.metadata.tags {
            *counts.entry(tag.as_str()).or_default() += 1;
        }
    }
    let mut sorted: Vec<(String, usize)> = counts.into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));
    sorted.truncate(max);
    sorted
}
