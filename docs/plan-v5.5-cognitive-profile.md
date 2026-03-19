# Plan: v5.5 Cognitive Profile Generator (BL-010)

## Open Questions

1. **Top tags count**: How many top tags to return? This plan defaults to 10. Configurable via parameter.

2. **Profile as text**: BL-010 mentions "natural language summary." Without an LLM, this plan generates a structured `CognitiveProfile` value. A `to_summary() -> String` method produces a human-readable text rendering from the struct. No inference needed.

---

## Phase 1: Profile Module + Computation

### Affected Files

- `crates/evolve-core/src/processor/profile.rs` — **NEW**: profile types + computation
- `crates/evolve-core/src/processor/mod.rs` — Add `profile` module
- `crates/evolve-core/src/processor/facade.rs` — Add `profile()` method
- `crates/evolve-core/src/simple.rs` — Add `profile()` convenience
- `crates/evolve-core/src/processor/tests.rs` — Profile tests

### Changes

**processor/profile.rs** — **NEW** file:

```rust
use crate::memory::types::{MemoryUnit, Tier};
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
        let mut lines = Vec::new();
        lines.push(format!("Memories: {} total ({} L1, {} L2, {} L3)",
            self.total_memories, self.l1_count, self.l2_count, self.l3_count));
        lines.push(format!("Associations: {} edges", self.edge_count));
        lines.push(format!("Avg saturation: {:.1}%", self.avg_saturation * 100.0));
        lines.push(format!("Crystallized: {} (σ ≥ 0.95)", self.crystallized_count));
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
pub fn compute(l1: &L1Cache, l2: &L2Graph, l3: &L3Vault, now: i64, max_tags: usize) -> CognitiveProfile {
    let l1_units: Vec<&MemoryUnit> = l1.iter_units(now).collect();
    let l2_units: Vec<&MemoryUnit> = l2.iter_units().collect();
    let l3_units: Vec<&MemoryUnit> = l3.iter_units().collect();

    let all_units: Vec<&&MemoryUnit> = l1_units.iter()
        .chain(l2_units.iter())
        .chain(l3_units.iter())
        .collect();

    let total = all_units.len();
    let avg_sat = if total > 0 {
        all_units.iter().map(|u| u.saturation).sum::<f32>() / total as f32
    } else {
        0.0
    };
    let crystallized = all_units.iter().filter(|u| u.saturation >= 0.95).count();
    let top_tags = compute_top_tags(&all_units, max_tags);

    CognitiveProfile {
        total_memories: total,
        l1_count: l1_units.len(),
        l2_count: l2_units.len(),
        l3_count: l3_units.len(),
        edge_count: l2.edge_count(),
        avg_saturation: avg_sat,
        crystallized_count: crystallized,
        top_tags,
    }
}

fn compute_top_tags(units: &[&&MemoryUnit], max: usize) -> Vec<(String, usize)> {
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
```

**processor/facade.rs** — add method:

```rust
pub fn profile(&self, now: i64) -> CognitiveProfile {
    profile::compute(&self.l1, &self.l2, &self.l3, now, 10)
}
```

**simple.rs** — add convenience:

```rust
pub fn profile(&self) -> CognitiveProfile {
    let now = chrono::Utc::now().timestamp_millis();
    self.processor.profile(now)
}
```

**processor/mod.rs** — add `pub mod profile;`

### Unit Tests

- `processor/tests.rs`
  - `test_profile_empty_system` — New processor: total_memories = 0, avg_saturation = 0.0
  - `test_profile_counts_tiers` — Encode to L2 and L3, verify l2_count and l3_count
  - `test_profile_avg_saturation` — Encode + boost, verify avg_saturation > 0
  - `test_profile_crystallized_count` — Promote to L3, verify crystallized_count > 0
  - `test_profile_top_tags` — Encode with tags, verify tag counts
  - `test_profile_to_summary_readable` — to_summary() contains "Memories:" and "Crystallized:"

- `simple.rs` (inline test)
  - `test_simple_profile` — SimpleMemory::profile() returns valid profile after adds

---

## Summary

| Phase | Focus | New Functions | New Tests |
|-------|-------|---------------|-----------|
| 1 | Profile Module | `compute`, `CognitiveProfile::to_summary`, `compute_top_tags`, `profile()` on facade + simple | 7 |

### Design Principles Applied

1. **Values over State**: `CognitiveProfile` is an immutable snapshot value. `compute()` is a pure function of tier state.
2. **No complecting**: Profile computation (profile.rs) is independent of query, SLO, and persistence. Pure read-only aggregation.
3. **Declarative**: `to_summary()` derives text from data. No template engine, no formatter config.

---

_Plan follows Simple Made Easy principles_
