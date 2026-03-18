# Plan: v5.0 UOR Identity & Thermodynamic Decay

## Open Questions

1. **BLAKE3 vs SHA-256**: BLAKE3 is ~3-6x faster and the UOR standard. But we already use SHA-256 everywhere. **Decision**: Add `blake3` crate. Keep SHA-256 available as secondary (chain verification backward compatibility during migration). New content-addressing uses BLAKE3.

2. **Fiber state storage cost**: Tracking per-bit pinning state for every memory adds overhead. **Decision**: Start with a simple `saturation: f32` (ratio of conceptual "fibers pinned" to "total fibers"). Full bit-level fiber tracking is Phase C (v5.2). This lets us validate the thermodynamic model without the algebraic complexity.

3. **Existing tests**: 95 tests reference the current `MemoryUnit` structure. **Decision**: Refactor types in place. Tests that break get updated. The type system catches everything.

---

## Phase 1: Content-Addressed Identity

Replace UUID-based identity with BLAKE3 content-addressed identity. Unify the three separate hash operations into one.

### Affected Files

- `crates/evolve-core/Cargo.toml` — Add `blake3` dependency
- `Cargo.toml` (workspace) — Add `blake3` to workspace deps
- `crates/evolve-core/src/chain/hash.rs` — Add `blake3()` function, keep `sha256()` for chain
- `crates/evolve-core/src/memory/types.rs` — Replace `UorId = Uuid` with `UorAddress`, remove `content_hash` field
- `crates/evolve-core/src/memory/encoder.rs` — Generate UorAddress from content, remove UUID
- `crates/evolve-core/src/tiers/*.rs` — Update HashMap key type from `Uuid` to `UorAddress`
- `crates/evolve-core/src/processor/types.rs` — Update Snapshot edge key type

### Changes

**Cargo.toml (workspace)** — add:
```toml
blake3 = "1"
```

**crates/evolve-core/Cargo.toml** — add:
```toml
blake3.workspace = true
```

**crates/evolve-core/src/chain/hash.rs** — add BLAKE3 function:

```rust
/// Compute BLAKE3 hash, returned as lowercase hex.
pub fn blake3_hash(data: &[u8]) -> String {
    blake3::hash(data).to_hex().to_string()
}

/// Compute UOR content address from string content.
pub fn content_address(content: &str) -> String {
    blake3_hash(content.as_bytes())
}
```

**crates/evolve-core/src/memory/types.rs** — new identity type:

```rust
/// Content-addressed memory identifier (BLAKE3 hex digest).
/// Two memories with identical content produce identical addresses.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UorAddress(pub String);

impl UorAddress {
    pub fn from_content(content: &str) -> Self {
        Self(crate::chain::hash::content_address(content))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for UorAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
```

**MemoryUnit** — replace `uor_id: UorId` + `content_hash: String` with single `address: UorAddress`:

```rust
pub struct MemoryUnit {
    pub address: UorAddress,           // REPLACES uor_id + content_hash
    pub embedding: Vec<f32>,           // Still present (Phase 2 changes this)
    pub created_at: i64,
    pub last_accessed: i64,
    pub access_count: u32,
    pub decay_factor: f32,             // Phase 2 changes this
    pub metadata: UnitMetadata,
}
```

**encoder.rs** — generate address from content:

```rust
let address = UorAddress::from_content(&input.content);
// Replaces: uor_id: Uuid::new_v4() + content_hash: hash::sha256(...)
```

**All tier files** (l1_cache.rs, l2_graph.rs, l3_vault.rs) — change `HashMap<UorId, ...>` to `HashMap<UorAddress, ...>` and `unit.uor_id` to `unit.address`.

**Snapshot** — change `l2_edges: HashMap<Uuid, Vec<Edge>>` to `HashMap<UorAddress, Vec<Edge>>`.

### Unit Tests

- `crates/evolve-core/src/chain/tests.rs`
  - `test_blake3_deterministic` — Same input produces same hash
  - `test_blake3_different_inputs` — Different inputs produce different hashes
  - `test_content_address_deterministic` — Same content = same address

- `crates/evolve-core/src/memory/tests.rs`
  - `test_uor_address_from_content` — Address derived from content string
  - `test_uor_address_deduplicates` — Same content → same address
  - `test_encode_produces_content_address` — Encoded unit has BLAKE3 address, not UUID

- **Validation benchmark** (not a unit test, but important):
  - `test_blake3_faster_than_sha256` — Encode 1000 memories, compare wall time of BLAKE3 vs SHA-256

---

## Phase 2: Saturation-Driven Decay

Replace fixed decay constant with thermodynamic model where decay rate is proportional to unresolvedness (temperature).

### Affected Files

- `crates/evolve-core/src/memory/types.rs` — Add `saturation` field to MemoryUnit, remove `decay_factor`
- `crates/evolve-core/src/memory/decay.rs` — Add `temperature()`, `effective_lambda()`, update `calculate_decay()`
- `crates/evolve-core/src/memory/decoder.rs` — Use new decay model
- `crates/evolve-core/src/memory/encoder.rs` — Initialize saturation at 0.0
- `crates/evolve-core/src/tiers/router.rs` — Route by saturation (σ ≥ threshold → L3)

### Changes

**memory/types.rs** — MemoryUnit gains saturation, loses decay_factor:

```rust
pub struct MemoryUnit {
    pub address: UorAddress,
    pub embedding: Vec<f32>,
    pub created_at: i64,
    pub last_accessed: i64,
    pub access_count: u32,
    pub saturation: f32,               // σ ∈ [0, 1] — replaces decay_factor
    pub metadata: UnitMetadata,
}
```

**memory/decay.rs** — thermodynamic decay model:

```rust
/// Context temperature derived from saturation.
/// T_ctx = (1 - σ) × ln(2)
/// At σ=0: T_ctx = ln(2) (maximum temperature)
/// At σ=1: T_ctx = 0 (ground state, no decay)
pub fn temperature(saturation: f32) -> f32 {
    (1.0 - saturation.clamp(0.0, 1.0)) * std::f32::consts::LN_2
}

/// Effective decay constant: λ_eff = λ_base × T_ctx
/// Saturated memories (σ=1) have λ_eff = 0 (no decay).
pub fn effective_lambda(base_lambda: f32, saturation: f32) -> f32 {
    base_lambda * temperature(saturation)
}

/// Thermodynamic CMHL decay.
/// w_current = w₀ × e^(-λ_eff × elapsed)
pub fn calculate_decay(
    last_accessed: i64,
    current_time: i64,
    half_life_ms: i64,
    saturation: f32,
) -> f32 {
    let elapsed = current_time - last_accessed;
    if elapsed <= 0 {
        return 1.0;
    }

    let base_lambda = std::f32::consts::LN_2 / half_life_ms as f32;
    let lambda_eff = effective_lambda(base_lambda, saturation);

    (-lambda_eff * elapsed as f32).exp()
}

/// Increase saturation based on access.
/// Each access pins conceptual fibers, increasing σ toward 1.0.
pub fn boost_saturation(current: f32, access_count: u32, boost_rate: f32) -> f32 {
    // Asymptotic approach to 1.0: σ' = 1 - (1 - σ) × e^(-boost_rate × accesses)
    let remaining = 1.0 - current;
    let pinned = remaining * (1.0 - (-boost_rate * access_count as f32).exp());
    (current + pinned).min(1.0)
}
```

**encoder.rs** — initialize saturation:

```rust
saturation: 0.0,  // New memory: unsaturated, high temperature, fast decay
```

**decoder.rs** — update to use new decay signature:

```rust
let decayed_weight = calculate_decay(
    unit.last_accessed,
    now,
    config.half_life_ms,
    unit.saturation,     // was: unit.decay_factor
);
```

**router.rs** — saturation-aware routing:

```rust
/// Route based on saturation + existing MTS logic.
/// σ ≥ crystallization_threshold → L3 (regardless of MTS)
fn determine_tier(mts_score: f32, saturation: f32, thresholds: &TierThresholds) -> Tier {
    if saturation >= 0.95 {
        return Tier::L3;  // Crystallized
    }
    if mts_score >= thresholds.l3 {
        Tier::L3
    } else if mts_score >= thresholds.l2 {
        Tier::L2
    } else {
        Tier::L1
    }
}
```

### Unit Tests

- `crates/evolve-core/src/memory/tests.rs`
  - `test_temperature_at_zero_saturation` — T_ctx = ln(2) (max temperature)
  - `test_temperature_at_full_saturation` — T_ctx = 0 (ground state)
  - `test_decay_saturated_memory_no_decay` — σ=1 memory doesn't decay regardless of time
  - `test_decay_unsaturated_memory_decays` — σ=0 memory decays at base rate
  - `test_decay_half_saturated_moderate` — σ=0.5 decays slower than σ=0
  - `test_boost_saturation_increases` — Each access increases σ
  - `test_boost_saturation_asymptotic` — σ approaches 1.0 but never exceeds it
  - `test_effective_lambda_zero_at_saturation` — λ_eff = 0 when σ = 1

- `crates/evolve-core/src/tiers/tests.rs`
  - `test_crystallized_memory_routes_to_l3` — σ ≥ 0.95 → L3 regardless of MTS

- **Validation test** (proves the theoretical benefit):
  - `test_self_optimization` — Encode memory, access it N times (boosting saturation), verify: (a) saturation increases, (b) decay rate decreases, (c) at σ=0.95+ it routes to L3

---

## Phase 3: L3 Address Lookup

Add O(1) address-based lookup to L3Vault, complementing the existing vector-scan for L1/L2.

### Affected Files

- `crates/evolve-core/src/tiers/l3_vault.rs` — Already has `HashMap<UorAddress, MemoryUnit>` — add `get_by_address()` method
- `crates/evolve-core/src/memory/decoder.rs` — Short-circuit L3 queries when address matches
- `crates/evolve-core/src/processor/facade.rs` — Use address lookup for L3 in `query()`

### Changes

**l3_vault.rs** — explicit address lookup (already possible via `get()`, make it first-class):

```rust
/// O(1) lookup by content address. Saturated memories skip vector scan.
pub fn get_by_address(&self, address: &UorAddress) -> Option<&MemoryUnit> {
    self.entries.get(address)
}
```

**processor/facade.rs** — in `query()`, try L3 address match first:

```rust
// Fast path: if query content matches an L3 entry by address, return immediately
let query_address = UorAddress::from_content(&query.content);
if let Some(unit) = self.l3.get_by_address(&query_address) {
    // O(1) exact match — skip vector scan entirely
    return Ok(QueryResult {
        recall: RecallResult {
            memories: vec![ScoredMemory {
                unit: unit.clone(),
                relevance_score: 1.0,
                decayed_weight: 1.0,  // Saturated, no decay
            }],
            metrics: RecallMetrics {
                latency_ms: start.elapsed().as_millis() as u64,
                tiers_queried: vec![Tier::L3],
                candidates_evaluated: 1,
                decay_filtered: 0,
            },
        },
        latency_ms: start.elapsed().as_millis() as u64,
    });
}
// Slow path: vector scan across tiers (existing code)
```

### Unit Tests

- `crates/evolve-core/src/processor/tests.rs`
  - `test_l3_address_lookup_o1` — Encode to L3 (sensitive tag), query same content, verify exact match returned without vector scan
  - `test_l3_address_miss_falls_through` — Query different content, verify vector scan used
  - `test_crystallized_memory_query_exact` — Encode, boost saturation to 0.95+, verify address lookup works

- **Validation benchmark**:
  - `test_l3_lookup_constant_time` — Insert N memories to L3 (N = 10, 100, 1000), query by address, verify latency is constant regardless of N

---

## Summary

| Phase | Focus | New Deps | Files Changed |
|-------|-------|----------|---------------|
| 1 | Content-addressed identity (BLAKE3) | `blake3` | ~12 files |
| 2 | Saturation-driven decay | 0 | ~5 files |
| 3 | L3 O(1) address lookup | 0 | ~3 files |

### Design Principles Applied

1. **Simple over Easy**: One hash (BLAKE3) replaces three (SHA-256 × 3)
2. **Values over State**: `UorAddress` is an immutable value derived from content
3. **Declarative**: `saturation` declares resolution state; `temperature()` derives behavior
4. **Composable**: Address lookup + vector scan compose — L3 gets fast path, L1/L2 unchanged
5. **No complecting**: Identity (address), relevance (saturation), and search (vector/hash) are independent axes

### Theoretical Claims Validated by Tests

| Claim | Test |
|-------|------|
| BLAKE3 is deterministic + content-derived | `test_blake3_deterministic`, `test_content_address_deterministic` |
| Same content = same address (dedup) | `test_uor_address_deduplicates` |
| Saturated memory doesn't decay | `test_decay_saturated_memory_no_decay` |
| Access drives crystallization | `test_self_optimization` |
| L3 query is O(1) | `test_l3_address_lookup_o1`, `test_l3_lookup_constant_time` |
| System self-optimizes | `test_self_optimization` (encode → access → saturate → L3 → O(1)) |

---

_Plan follows Simple Made Easy principles_
