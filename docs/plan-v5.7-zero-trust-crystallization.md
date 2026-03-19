# Plan: v5.7 Zero-Trust Crystallization (BL-006 + BL-005 + BL-004 foundation)

## Open Questions

1. **Pending queue persistence**: When crystallization is guarded, memories reaching σ≥0.95 stay in L2 as "pending crystallization." Should the pending set be tracked explicitly (a `HashSet<UorAddress>`) or inferred (scan L2 for σ≥0.95)? This plan infers — no extra state.

2. **Trust level granularity**: This plan uses 3 levels (Unverified/UserReviewed/Verified). Should there be a continuous 0.0–1.0 trust score instead? The 3-level enum is simpler and maps to clear initial σ values.

3. **SimpleMemory headroom**: simple.rs is at 250 lines. New methods require extracting inline tests to a separate test file (`simple/tests.rs`) or trimming doc comments. This plan converts simple.rs to a module directory.

---

## Phase 0: SimpleMemory + Facade Extraction (Section 4 headroom)

### Phase 0a: SimpleMemory Test Extraction

#### Affected Files

- `crates/evolve-core/src/simple.rs` — Rename to `simple/mod.rs`, remove inline tests
- `crates/evolve-core/src/simple/tests.rs` — **NEW**: extracted inline tests

#### Changes

Convert `simple.rs` to a module directory:
1. Create `crates/evolve-core/src/simple/` directory
2. Move `simple.rs` to `simple/mod.rs`
3. Move the `#[cfg(test)] mod tests { ... }` block (lines 144-250, ~106 lines) to `simple/tests.rs`
4. Replace with `#[cfg(test)] mod tests;` in `mod.rs`

Result: `simple/mod.rs` drops from 250 to ~144 lines. 106 lines of headroom for Phase 1+2 additions.

#### Unit Tests
- All 12 existing SimpleMemory tests continue to pass unchanged.

---

### Phase 0b: Facade Trust Extraction

### Affected Files

- `crates/evolve-core/src/processor/trust.rs` — **NEW**: trust mutation operations extracted from facade
- `crates/evolve-core/src/processor/facade.rs` — Replace trust operations with delegations
- `crates/evolve-core/src/processor/mod.rs` — Add `trust` module

### Changes

**processor/trust.rs** — **NEW** file. Extract `record_access`, `record_conflict`, `pin_session_peers` from facade.rs as free functions operating on tier references:

```rust
use crate::memory::decay;
use crate::memory::types::{PinningEvent, UorAddress};
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Crystallization policy.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CrystallizationPolicy {
    Auto,            // Promote at σ≥0.95 (legacy behavior)
    RequireApproval, // Never auto-promote, require approve_crystallization()
}

impl Default for CrystallizationPolicy {
    fn default() -> Self {
        Self::RequireApproval  // Zero-trust default
    }
}

/// Boost saturation on a memory. Returns true if found.
/// Optionally promotes L2→L3 based on policy.
pub fn record_access(
    l2: &mut L2Graph, l3: &mut L3Vault,
    addr: &UorAddress, event: PinningEvent,
    policy: CrystallizationPolicy,
) -> bool {
    if let Some(unit) = l2.get_mut(addr) {
        unit.saturation = decay::boost_saturation_weighted(unit.saturation, event);
        unit.access_count += 1;
        if policy == CrystallizationPolicy::Auto && unit.saturation >= 0.95 {
            if let Some(promoted) = l2.remove(addr) {
                l3.store(promoted);
            }
        }
        return true;
    }
    if let Some(unit) = l3.get_mut(addr) {
        unit.saturation = decay::boost_saturation_weighted(unit.saturation, event);
        unit.access_count += 1;
        return true;
    }
    false
}

/// Inject entropy to reduce saturation.
pub fn record_conflict(
    l2: &mut L2Graph, l3: &mut L3Vault,
    addr: &UorAddress, severity: f32,
) -> Option<f32> {
    if let Some(unit) = l2.get_mut(addr) {
        unit.saturation = decay::inject_entropy(unit.saturation, severity);
        return Some(unit.saturation);
    }
    if let Some(unit) = l3.get_mut(addr) {
        unit.saturation = decay::inject_entropy(unit.saturation, severity);
        return Some(unit.saturation);
    }
    None
}

/// Explicitly approve crystallization. Promotes L2→L3 only if σ≥0.95.
/// Returns true if promoted, false if not found or σ too low.
pub fn approve_crystallization(l2: &mut L2Graph, l3: &mut L3Vault, addr: &UorAddress) -> bool {
    if let Some(unit) = l2.get(addr) {
        if unit.saturation >= 0.95 {
            if let Some(promoted) = l2.remove(addr) {
                l3.store(promoted);
                return true;
            }
        }
    }
    false
}

/// Pin session peers with CrossReference events.
pub fn pin_session_peers(l2: &mut L2Graph, session_log: &[(UorAddress, i64)]) {
    for (peer_addr, _) in session_log {
        if let Some(unit) = l2.get_mut(peer_addr) {
            unit.saturation = decay::boost_saturation_weighted(
                unit.saturation, PinningEvent::CrossReference,
            );
        }
    }
}
```

**processor/facade.rs** — Replace inline implementations with delegations:

```rust
pub fn record_access(&mut self, addr: &UorAddress, event: PinningEvent) -> bool {
    trust::record_access(&mut self.l2, &mut self.l3, addr, event, self.config.crystallization)
}

pub fn record_conflict(&mut self, addr: &UorAddress, severity: f32) -> Option<f32> {
    trust::record_conflict(&mut self.l2, &mut self.l3, addr, severity)
}

pub fn approve_crystallization(&mut self, addr: &UorAddress) -> bool {
    trust::approve_crystallization(&mut self.l2, &mut self.l3, addr)
}
```

And replace `pin_session_peers`:

```rust
fn pin_session_peers(&mut self, _new_addr: &UorAddress, _now: i64) {
    trust::pin_session_peers(&mut self.l2, &self.session_log);
}
```

This replaces ~43 lines with ~12 lines, freeing ~31 lines.

### Unit Tests

- Existing `record_access`, `record_conflict`, promotion, and session tests continue to pass.

---

## Phase 1: Crystallization Guard (BL-006)

### Affected Files

- `crates/evolve-core/src/processor/types.rs` — Add `crystallization` field to ProcessorConfig
- `crates/evolve-core/src/processor/tests.rs` — Guard tests
- `crates/evolve-core/src/simple.rs` — Add `approve_crystallization()`

### Changes

**processor/types.rs** — add to ProcessorConfig:

```rust
pub crystallization: CrystallizationPolicy,
```

Default: `CrystallizationPolicy::RequireApproval` (zero-trust).

**simple.rs** — add method:

```rust
pub fn approve_crystallization(&mut self, addr: &UorAddress) -> bool {
    self.processor.approve_crystallization(addr)
}
```

### Unit Tests

- `processor/tests.rs`
  - `test_require_approval_blocks_auto_promotion` — With RequireApproval policy, boost σ past 0.95: memory stays in L2, NOT promoted
  - `test_approve_crystallization_promotes` — After σ≥0.95, call approve_crystallization: memory moves to L3
  - `test_approve_crystallization_rejects_low_sigma` — Call approve on σ=0.5 memory: returns false, stays in L2
  - `test_auto_policy_still_works` — With Auto policy, legacy behavior: auto-promotes at σ≥0.95
  - `test_default_policy_is_require_approval` — ProcessorConfig::default() has RequireApproval

---

## Phase 2: Source Provenance (BL-005)

### Affected Files

- `crates/evolve-core/src/memory/types.rs` — Add `TrustLevel` enum to InputMetadata
- `crates/evolve-core/src/memory/encoder.rs` — Initial σ from trust level
- `crates/evolve-core/src/memory/tests.rs` — Provenance tests
- `crates/evolve-core/src/simple.rs` — `add_trusted()` convenience

### Changes

**memory/types.rs** — add enum + field:

```rust
/// Trust level of the memory source. Determines initial saturation.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrustLevel {
    #[default]
    Unverified,     // LLM-generated, no human check → σ₀ = 0.0
    UserReviewed,   // Human reviewed content → σ₀ = 0.1
    Verified,       // Cryptographically verified source → σ₀ = 0.3
}

impl TrustLevel {
    pub fn initial_saturation(&self) -> f32 {
        match self {
            Self::Unverified => 0.0,
            Self::UserReviewed => 0.1,
            Self::Verified => 0.3,
        }
    }
}
```

Add to InputMetadata:

```rust
pub struct InputMetadata {
    pub tags: Vec<String>,
    pub source: Option<String>,
    pub priority: Priority,
    pub sensitivity: Sensitivity,
    pub trust: TrustLevel,  // NEW
}
```

**memory/encoder.rs** — use trust level for initial σ:

```rust
saturation: input.metadata.trust.initial_saturation(),  // Was: 0.0
```

**simple.rs** — add convenience:

```rust
pub async fn add_trusted(
    &mut self, content: &str, trust: TrustLevel,
) -> Result<UorAddress, EngineError> {
    // Same as add() but with explicit trust level
}
```

### Unit Tests

- `memory/tests.rs`
  - `test_unverified_starts_at_zero` — TrustLevel::Unverified → σ₀ = 0.0
  - `test_user_reviewed_starts_higher` — TrustLevel::UserReviewed → σ₀ = 0.1
  - `test_verified_starts_highest` — TrustLevel::Verified → σ₀ = 0.3
  - `test_encode_respects_trust_level` — Encode with UserReviewed: unit.saturation = 0.1

---

## Summary

| Phase | Focus | Addresses | New Tests |
|-------|-------|-----------|-----------|
| 0 | Trust Extraction | Section 4 headroom | 0 (existing pass) |
| 1 | Crystallization Guard | BL-006 | 5 |
| 2 | Source Provenance | BL-005 | 4 |

### Zero-Trust Properties Achieved

| Property | Before v5.7 | After v5.7 |
|----------|------------|-----------|
| Auto-crystallization | Always (σ≥0.95 → L3) | **RequireApproval by default** |
| Initial σ for LLM content | 0.0 (same as everything) | **0.0 (Unverified)** — explicit |
| Initial σ for human-reviewed | 0.0 (same as everything) | **0.1 (UserReviewed)** — head start |
| Initial σ for verified sources | 0.0 (same as everything) | **0.3 (Verified)** — significant head start |
| Crystallization requires | Nothing — just access events | **Explicit approval call** |

### Design Principles Applied

1. **Zero-trust by default**: `CrystallizationPolicy::RequireApproval` is the default. `Auto` is opt-in for trusted environments.
2. **Values over State**: `TrustLevel` is an enum value on input, not mutable state. `CrystallizationPolicy` is config, not runtime state.
3. **No complecting**: Trust extraction (trust.rs) separates mutation logic from the facade's coordination role. Provenance (TrustLevel) is on the input, not the storage layer.
4. **Inferred, not tracked**: Pending crystallization is detected by scanning L2 for σ≥0.95, not maintained as a separate list.

---

_Plan follows Simple Made Easy principles_
