# Plan: v5.2 Associative Linking & Tier Promotion

## Open Questions

1. **Edge weight formula**: BL-012 specifies "proportional to temporal proximity." This plan uses `1.0 / (1.0 + gap_ms / 1000.0)` — memories encoded 0ms apart get weight 1.0, memories 10s apart get weight ~0.09. Is this decay curve appropriate?

2. **Promotion edge cleanup**: When a memory promotes L2→L3, should its L2 edges be deleted or preserved? This plan deletes them — a promoted memory graduates from the relational graph to the permanent vault. Its neighbors retain their own edges to each other.

3. **Bidirectional edges**: Should co-capture edges be bidirectional (A→B and B→A)? This plan creates bidirectional edges — both memories are co-captured, so the relationship is symmetric.

---

## Phase 1: Facade Query Extraction (Section 4 headroom)

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Remove query helpers
- `crates/evolve-core/src/processor/query.rs` — **NEW**: query logic extracted
- `crates/evolve-core/src/processor/mod.rs` — Add `query` module

### Changes

**processor/query.rs** — **NEW** file. Extract `try_l3_exact_match`, `vector_scan_query`, `collect_candidates` as free functions:

```rust
use crate::memory::decoder;
use crate::memory::types::*;
use crate::processor::types::{ProcessorConfig, QueryResult, tier_list};
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

pub fn try_l3_exact_match(
    l3: &L3Vault,
    content: &str,
    start: std::time::Instant,
) -> Option<QueryResult> {
    // ... existing logic, taking l3 as parameter instead of &self
}

pub async fn vector_scan<E: RepresentationEngine>(
    engine: &E,
    config: &ProcessorConfig,
    l1: &L1Cache, l2: &L2Graph, l3: &L3Vault,
    query: &Query, now: i64,
    start: std::time::Instant,
) -> Result<QueryResult, EngineError> {
    // ... existing logic, taking components as parameters
}

fn collect_candidates<'a>(
    l1: &'a L1Cache, l2: &'a L2Graph, l3: &'a L3Vault,
    query: &Query, now: i64,
) -> Vec<&'a MemoryUnit> {
    // ... existing logic
}
```

**processor/facade.rs** — Replace the 3 private query methods with delegations:

```rust
pub async fn query(&self, query: &Query, now: i64) -> Result<QueryResult, EngineError> {
    let start = std::time::Instant::now();
    let allows_l3 = matches!(query.constraints.require_tier, None | Some(Tier::L3));
    if allows_l3 {
        if let Some(result) = query_mod::try_l3_exact_match(&self.l3, &query.content, start) {
            return Ok(result);
        }
    }
    query_mod::vector_scan(&self.engine, &self.config, &self.l1, &self.l2, &self.l3, query, now, start).await
}
```

This replaces ~73 lines with ~8 lines, freeing ~65 lines for Phase 2 and 3.

**processor/mod.rs** — add `pub mod query;`

### Unit Tests

- Existing query tests continue to pass unchanged — public API is identical.

---

## Phase 2: Co-Capture Linking (BL-012)

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Add session log, link on encode
- `crates/evolve-core/src/tiers/l2_graph.rs` — Add `link_to_session()`
- `crates/evolve-core/src/processor/tests.rs` — Co-capture tests
- `crates/evolve-core/src/tiers/tests.rs` — Graph linking tests

### Changes

**processor/facade.rs** — add field + session methods:

```rust
pub struct MemoryProcessor<E: RepresentationEngine> {
    // ... existing fields
    session_log: Vec<(UorAddress, i64)>,
}

// In new():
    session_log: Vec::new(),
```

In `encode()`, after L2 insert:

```rust
if decision.tier == Tier::L2 {
    self.l2.link_to_session(&unit.address, &self.session_log, now);
    for (peer_addr, _) in &self.session_log {
        if self.l2.get(peer_addr).is_some() {
            decay::boost_saturation_weighted_on(&mut self.l2, peer_addr, PinningEvent::CrossReference);
        }
    }
    self.session_log.push((unit.address.clone(), now));
}
```

Add `clear_session()`:

```rust
pub fn clear_session(&mut self) {
    self.session_log.clear();
}
```

**tiers/l2_graph.rs** — add method:

```rust
/// Link a new node to all session peers in this graph.
/// Edge weight: 1.0 / (1.0 + time_gap_ms / 1000.0) — closer = stronger.
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
        // Bidirectional edges
        self.add_edge(new_addr.clone(), peer_addr.clone(), weight, now);
        self.add_edge(peer_addr.clone(), new_addr.clone(), weight, now);
    }
}
```

### Unit Tests

- `tiers/tests.rs`
  - `test_link_to_session_creates_bidirectional_edges` — Encode 3 nodes, link_to_session for each, verify edges A↔B, A↔C, B↔C
  - `test_link_to_session_weight_decreases_with_gap` — Two memories 0ms apart vs 10s apart: weight[0ms] > weight[10s]
  - `test_link_to_session_skips_missing_peers` — Session references a removed node, no panic

- `processor/tests.rs`
  - `test_encode_creates_session_edges` — Encode 3 memories to L2, verify edge_count > 0
  - `test_encode_cross_reference_pins_peers` — Encode 2 memories, verify first memory's σ increased from CrossReference
  - `test_clear_session_resets` — Encode, clear_session, encode again — no edges to pre-clear memories

---

## Phase 3: Saturation-Driven Tier Promotion

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Add promotion check in `record_access()`
- `crates/evolve-core/src/processor/tests.rs` — Promotion tests

### Changes

**processor/facade.rs** — modify `record_access()`:

```rust
pub fn record_access(&mut self, addr: &UorAddress, event: PinningEvent) -> bool {
    if let Some(unit) = self.l2.get_mut(addr) {
        unit.saturation = decay::boost_saturation_weighted(unit.saturation, event);
        unit.access_count += 1;
        // Promote to L3 if crystallized
        if unit.saturation >= 0.95 {
            if let Some(promoted) = self.l2.remove(addr) {
                self.l3.store(promoted);
            }
        }
        return true;
    }
    if let Some(unit) = self.l3.get_mut(addr) {
        unit.saturation = decay::boost_saturation_weighted(unit.saturation, event);
        unit.access_count += 1;
        return true;
    }
    false
}
```

### Unit Tests

- `processor/tests.rs`
  - `test_promotion_l2_to_l3_on_crystallization` — Encode to L2, record_access with CryptoVerification until σ≥0.95, verify memory moved from L2 to L3
  - `test_promoted_memory_queryable_by_address` — After promotion, query by exact content returns O(1) L3 match
  - `test_promotion_removes_from_l2` — After promotion, L2 node_count decreases by 1
  - `test_no_promotion_below_threshold` — record_access with Access events (low weight) — σ stays below 0.95, memory stays in L2

---

## Summary

| Phase | Focus | New Functions | New Tests |
|-------|-------|---------------|-----------|
| 1 | Query Extraction | `query::try_l3_exact_match`, `query::vector_scan`, `query::collect_candidates` | 0 (existing tests validate) |
| 2 | Co-Capture Linking | `L2Graph::link_to_session`, `clear_session`, session edge creation | 6 |
| 3 | Tier Promotion | Promotion check in `record_access` | 4 |

### Design Principles Applied

1. **No complecting**: Query logic (query.rs), persistence (persist.rs), and core operations (facade.rs) are independent modules. Session linking is in L2Graph (graph concern). Promotion is in record_access (transition concern).
2. **Values over State**: `link_to_session` takes a session slice (value) not a session object. Edge weight is a pure formula.
3. **Composable**: Co-capture edges → CrossReference pins → σ rises → promotion → O(1) lookup. Each step is independent, they compose into the self-optimization loop.

---

_Plan follows Simple Made Easy principles_
