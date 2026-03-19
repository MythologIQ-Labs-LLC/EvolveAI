# Plan: v5.1 Bidirectional Thermodynamics

## Open Questions

1. **Tier migration on σ change**: When `record_access()` pushes σ past 0.95, should the memory auto-migrate to L3? This plan does NOT auto-migrate — it updates σ in place. Auto-migration is a v5.2 concern (requires removing from source tier + inserting into L3 + chain logging).

2. **Entropy injection granularity**: Should `inject_entropy()` accept a severity float (0.0–1.0) or derive it from `Severity` enum? This plan uses a float for composability — the caller maps Severity→float.

3. **L1 pinning**: L1 is ephemeral (TTL-based eviction). Should access events boost σ for L1 entries? This plan skips L1 — boosting an ephemeral entry's saturation is wasted work unless it promotes to L2 first.

---

## Phase 0: Facade Extraction (Section 4 Remediation)

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Extract persistence methods
- `crates/evolve-core/src/processor/persist.rs` — **NEW**: persistence logic
- `crates/evolve-core/src/processor/mod.rs` — Add `persist` module

### Changes

**processor/persist.rs** — **NEW** file. Extract `snapshot()`, `restore()`, `save_to_file()`, `load_from_file()` from facade.rs as free functions that take `&MemoryProcessor<E>` or `&mut MemoryProcessor<E>`:

```rust
use crate::chain::ledger::Ledger;
use crate::processor::types::{PersistError, Snapshot, SNAPSHOT_VERSION};
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;
use crate::shadow::genome::ShadowGenome;

/// Capture a snapshot of the persistable system state.
pub fn snapshot(l2: &L2Graph, l3: &L3Vault, shadow: &ShadowGenome, now: i64) -> Snapshot {
    Snapshot {
        version: SNAPSHOT_VERSION.to_string(),
        created_at: now,
        l2_nodes: l2.nodes_vec(),
        l2_edges: l2.edges_map().clone(),
        l3_entries: l3.entries_vec(),
        l3_blocks: l3.ledger().blocks().to_vec(),
        shadow_entries: shadow.export_entries(),
    }
}

/// Restore from snapshot. Verifies chain integrity and version.
pub fn restore(
    l2: &mut L2Graph,
    l3: &mut L3Vault,
    shadow: &mut ShadowGenome,
    snap: Snapshot,
) -> Result<(), PersistError> {
    if snap.version != SNAPSHOT_VERSION {
        return Err(PersistError::IncompatibleVersion {
            expected: SNAPSHOT_VERSION.to_string(),
            found: snap.version,
        });
    }
    let ledger = Ledger::from_blocks(snap.l3_blocks);
    if !ledger.verify() {
        return Err(PersistError::ChainIntegrityFailed);
    }
    *l2 = L2Graph::from_parts(snap.l2_nodes, snap.l2_edges);
    *l3 = L3Vault::from_parts(snap.l3_entries, ledger);
    shadow.import_entries(snap.shadow_entries);
    Ok(())
}

/// Save system state to a JSON file (atomic: write-tmp-then-rename).
pub fn save_to_file(
    l2: &L2Graph, l3: &L3Vault, shadow: &ShadowGenome,
    path: &std::path::Path, now: i64,
) -> Result<(), PersistError> {
    let snap = snapshot(l2, l3, shadow, now);
    let json = serde_json::to_string_pretty(&snap)?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, &json)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

/// Load from JSON file. Verifies integrity and version.
pub fn load_from_file(
    l2: &mut L2Graph, l3: &mut L3Vault, shadow: &mut ShadowGenome,
    path: &std::path::Path,
) -> Result<(), PersistError> {
    let json = std::fs::read_to_string(path)?;
    let snap: Snapshot = serde_json::from_str(&json)?;
    restore(l2, l3, shadow, snap)
}
```

**processor/facade.rs** — Replace the 4 persistence methods with thin delegations:

```rust
pub fn snapshot(&self, now: i64) -> Snapshot {
    persist::snapshot(&self.l2, &self.l3, &self.shadow, now)
}

pub fn restore(&mut self, snap: Snapshot) -> Result<(), PersistError> {
    persist::restore(&mut self.l2, &mut self.l3, &mut self.shadow, snap)
}

pub fn save_to_file(&self, path: &std::path::Path, now: i64) -> Result<(), PersistError> {
    persist::save_to_file(&self.l2, &self.l3, &self.shadow, path, now)
}

pub fn load_from_file(&mut self, path: &std::path::Path) -> Result<(), PersistError> {
    persist::load_from_file(&mut self.l2, &mut self.l3, &mut self.shadow, path)
}
```

This replaces ~38 lines with ~16 lines (4 one-line delegations + imports), freeing ~22 lines for Phase 1 and Phase 2 additions.

**processor/mod.rs** — add module:

```rust
pub mod persist;
```

### Unit Tests

- Existing persistence tests (`test_save_and_load_file`, `test_restore_recovers_state`, etc.) continue to pass unchanged — the public API is identical.

---

## Phase 1: Weighted Pinning Hierarchy

### Affected Files

- `crates/evolve-core/src/memory/types.rs` — Add `PinningEvent` enum
- `crates/evolve-core/src/memory/decay.rs` — Add `pin_weight()`, `boost_saturation_weighted()`
- `crates/evolve-core/src/tiers/l2_graph.rs` — Add `get_mut()`
- `crates/evolve-core/src/tiers/l3_vault.rs` — Add `get_mut()`
- `crates/evolve-core/src/processor/facade.rs` — Add `record_access()`
- `crates/evolve-core/src/memory/tests.rs` — Weighted pinning tests
- `crates/evolve-core/src/processor/tests.rs` — Access recording tests

### Changes

**memory/types.rs** — add after `Sensitivity` enum:

```rust
/// Events that pin fibers, increasing saturation.
/// Weighted to prevent access spam from artificially crystallizing junk data.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum PinningEvent {
    Access,              // Low:    usage confirms relevance
    CrossReference,      // Medium: relational evidence
    Corroboration,       // Medium: convergent independent evidence
    CryptoVerification,  // High:   structural integrity confirmed
}
```

**memory/decay.rs** — add two functions:

```rust
/// Weight of a pinning event. Higher weight = more fibers pinned per event.
pub fn pin_weight(event: PinningEvent) -> f32 {
    match event {
        PinningEvent::Access => 0.01,
        PinningEvent::CrossReference => 0.05,
        PinningEvent::Corroboration => 0.05,
        PinningEvent::CryptoVerification => 0.15,
    }
}

/// Boost saturation by a weighted pinning event.
/// σ' = 1 - (1 - σ) × e^(-weight)
pub fn boost_saturation_weighted(current: f32, event: PinningEvent) -> f32 {
    let weight = pin_weight(event);
    let remaining = 1.0 - current;
    let pinned = remaining * (1.0 - (-weight).exp());
    (current + pinned).min(1.0)
}
```

**tiers/l2_graph.rs** — add method to `L2Graph`:

```rust
/// Get a mutable reference to a node by address.
pub fn get_mut(&mut self, addr: &UorAddress) -> Option<&mut MemoryUnit> {
    self.nodes.get_mut(addr)
}
```

**tiers/l3_vault.rs** — add method to `L3Vault`:

```rust
/// Get a mutable reference to an entry by address.
pub fn get_mut(&mut self, addr: &UorAddress) -> Option<&mut MemoryUnit> {
    self.entries.get_mut(addr)
}
```

**processor/facade.rs** — add method to `MemoryProcessor`:

```rust
/// Record an access event, boosting the memory's saturation.
/// Searches L2 then L3 (L1 is ephemeral, not worth boosting).
pub fn record_access(&mut self, addr: &UorAddress, event: PinningEvent) -> bool {
    if let Some(unit) = self.l2.get_mut(addr) {
        unit.saturation = decay::boost_saturation_weighted(unit.saturation, event);
        unit.access_count += 1;
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

Add `use crate::memory::decay;` and `use crate::memory::types::PinningEvent;` to facade imports. (PinningEvent comes in via `use crate::memory::types::*;` already.)

### Unit Tests

- `memory/tests.rs`
  - `test_crypto_verification_pins_faster_than_access` — 10 Access events vs 2 CryptoVerification events: CryptoVerification produces higher σ
  - `test_cross_reference_pins_at_medium_weight` — CrossReference weight > Access weight for same event count
  - `test_pin_weight_ordering` — CryptoVerification > CrossReference = Corroboration > Access
  - `test_boost_weighted_never_exceeds_one` — 1000 CryptoVerification events still σ ≤ 1.0

- `processor/tests.rs`
  - `test_record_access_boosts_saturation` — Encode memory, record_access with CryptoVerification, verify σ increased
  - `test_record_access_not_found` — record_access on nonexistent address returns false
  - `test_record_access_increments_count` — access_count increases with each record_access call

---

## Phase 2: Entropy Injection

### Affected Files

- `crates/evolve-core/src/memory/decay.rs` — Add `inject_entropy()`
- `crates/evolve-core/src/processor/facade.rs` — Add `record_conflict()`
- `crates/evolve-core/src/memory/tests.rs` — Entropy injection tests
- `crates/evolve-core/src/processor/tests.rs` — Conflict recording + evaporation tests

### Changes

**memory/decay.rs** — add function:

```rust
/// Inject entropy into a memory, unpinning fibers.
/// Reduces σ by severity, clamped to [0.0, 1.0].
/// Models thermodynamic conflict: disputed objects heat up and decay faster.
pub fn inject_entropy(current: f32, severity: f32) -> f32 {
    (current - severity.clamp(0.0, 1.0)).max(0.0)
}
```

**processor/facade.rs** — add method to `MemoryProcessor`:

```rust
/// Record a conflict against a memory, injecting entropy.
/// Reduces the memory's saturation, causing it to heat up and decay faster.
/// Returns the new saturation, or None if address not found.
pub fn record_conflict(&mut self, addr: &UorAddress, severity: f32) -> Option<f32> {
    if let Some(unit) = self.l2.get_mut(addr) {
        unit.saturation = decay::inject_entropy(unit.saturation, severity);
        return Some(unit.saturation);
    }
    if let Some(unit) = self.l3.get_mut(addr) {
        unit.saturation = decay::inject_entropy(unit.saturation, severity);
        return Some(unit.saturation);
    }
    None
}
```

### Unit Tests

- `memory/tests.rs`
  - `test_inject_entropy_reduces_saturation` — σ=0.8, severity=0.3 → σ=0.5
  - `test_inject_entropy_clamps_to_zero` — σ=0.2, severity=0.5 → σ=0.0
  - `test_inject_entropy_zero_severity_no_change` — σ=0.8, severity=0.0 → σ=0.8
  - `test_entropy_spikes_temperature` — After inject_entropy, temperature(new_σ) > temperature(old_σ)
  - `test_entropy_accelerates_decay` — After inject_entropy, calculate_decay returns lower weight for same elapsed time

- `processor/tests.rs`
  - `test_conflict_reduces_saturation` — Encode, boost to σ=0.8, record_conflict(0.3), verify σ≈0.5
  - `test_conflict_evaporates_disputed_memory` — Encode, boost to σ=0.5, record_conflict(0.5) → σ=0.0 → should_prune returns true after minimal elapsed time
  - `test_crystallized_memory_survives_minor_conflict` — Boost to σ=1.0, record_conflict(0.03), verify σ=0.97 (still above 0.95 crystallization threshold)
  - `test_crystallized_memory_decrystallizes_on_major_conflict` — Boost to σ=1.0, record_conflict(0.2), verify σ=0.8 (below crystallization, re-enters decay pool)
  - `test_conflict_not_found` — record_conflict on nonexistent address returns None

---

## Summary

| Phase | Focus | New Functions | New Tests |
|-------|-------|---------------|-----------|
| 0 | Facade Extraction | `persist::snapshot`, `persist::restore`, `persist::save_to_file`, `persist::load_from_file` | 0 (existing tests validate) |
| 1 | Weighted Pinning | `pin_weight`, `boost_saturation_weighted`, `get_mut` ×2, `record_access` | 7 |
| 2 | Entropy Injection | `inject_entropy`, `record_conflict` | 10 |

### Design Principles Applied

1. **Values over State**: `PinningEvent` is an enum value. `pin_weight()`, `inject_entropy()`, `boost_saturation_weighted()` are pure functions.
2. **Simple over Easy**: No automatic tier migration on σ change. No automatic conflict detection. The caller composes these primitives.
3. **No complecting**: Pinning logic (decay.rs) is independent of storage logic (tiers). The processor facade composes them without braiding.
4. **Declarative**: `PinningEvent` declares *what happened*. `pin_weight()` derives *how much it matters*. No imperative "if crypto then boost by 0.15."

---

_Plan follows Simple Made Easy principles_
