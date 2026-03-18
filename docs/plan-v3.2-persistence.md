# Plan: v3.2 Persistence Layer

## Open Questions

1. **Snapshot format**: JSON for human readability, or bincode for speed? **Decision**: JSON — inspectable, debuggable, no new dependency. If performance matters later, add bincode behind a feature flag.

2. **L1 persistence**: L1 is an ephemeral TTL cache. Should it survive restart? **Decision**: No — L1 is intentionally volatile. Only L2 (graph) and L3 (vault + ledger) are persisted.

---

## Phase 1: Serialization Support

Add `Serialize`/`Deserialize` derives to types that currently lack them, and define a `Snapshot` struct that captures the persistable state.

### Affected Files

- `crates/evolve-core/src/tiers/l2_graph.rs` — Add serde derives to `Edge`
- `crates/evolve-core/src/chain/ledger.rs` — Add serde derives to `Ledger`
- `crates/evolve-core/src/processor/types.rs` — Add `Snapshot` struct

### Changes

**crates/evolve-core/src/tiers/l2_graph.rs** — add derives to `Edge`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Edge {
    // ... existing fields unchanged
}
```

**crates/evolve-core/src/chain/ledger.rs** — add derives to `Ledger`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Ledger {
    blocks: Vec<Block>,
}
```

**crates/evolve-core/src/processor/types.rs** — add `Snapshot`:

```rust
use crate::chain::block::Block;
use crate::memory::types::MemoryUnit;
use crate::tiers::l2_graph::Edge;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Persistable snapshot of the memory system state.
/// Captures L2 graph and L3 vault. L1 is intentionally excluded (ephemeral).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Snapshot {
    pub version: String,
    pub created_at: i64,
    pub l2_nodes: Vec<MemoryUnit>,
    pub l2_edges: HashMap<Uuid, Vec<Edge>>,
    pub l3_entries: Vec<MemoryUnit>,
    pub l3_blocks: Vec<Block>,
}
```

### Unit Tests

- `crates/evolve-core/src/processor/tests.rs`
  - `test_snapshot_serialization_roundtrip` — Serialize snapshot to JSON, deserialize back, verify equality

---

## Phase 2: Snapshot & Restore on Processor

Add `snapshot()` and `restore()` methods to the processor, plus extraction methods on L2Graph and L3Vault.

### Affected Files

- `crates/evolve-core/src/tiers/l2_graph.rs` — Add `nodes()`, `edges_map()`, `from_parts()` methods
- `crates/evolve-core/src/tiers/l3_vault.rs` — Add `entries()`, `from_parts()` methods
- `crates/evolve-core/src/chain/ledger.rs` — Add `from_blocks()` constructor
- `crates/evolve-core/src/processor/facade.rs` — Add `snapshot()`, `restore()` methods

### Changes

**crates/evolve-core/src/tiers/l2_graph.rs** — extraction + reconstruction:

```rust
/// Get all nodes as a vec (for snapshotting).
pub fn nodes_vec(&self) -> Vec<MemoryUnit> {
    self.nodes.values().cloned().collect()
}

/// Get edges map (for snapshotting).
pub fn edges_map(&self) -> &HashMap<UorId, Vec<Edge>> {
    &self.edges
}

/// Reconstruct from parts.
pub fn from_parts(nodes: Vec<MemoryUnit>, edges: HashMap<UorId, Vec<Edge>>) -> Self {
    let node_map: HashMap<UorId, MemoryUnit> = nodes.into_iter().map(|u| (u.uor_id, u)).collect();
    Self { nodes: node_map, edges }
}
```

**crates/evolve-core/src/tiers/l3_vault.rs** — extraction + reconstruction:

```rust
/// Get all entries as a vec (for snapshotting).
pub fn entries_vec(&self) -> Vec<MemoryUnit> {
    self.entries.values().cloned().collect()
}

/// Reconstruct from parts (entries + ledger blocks).
pub fn from_parts(entries: Vec<MemoryUnit>, ledger: Ledger) -> Self {
    let entry_map: HashMap<UorId, MemoryUnit> = entries.into_iter().map(|u| (u.uor_id, u)).collect();
    Self { entries: entry_map, ledger }
}
```

**crates/evolve-core/src/chain/ledger.rs** — reconstruction:

```rust
/// Reconstruct ledger from existing blocks.
/// Caller must ensure blocks form a valid chain.
pub fn from_blocks(blocks: Vec<Block>) -> Self {
    assert!(!blocks.is_empty(), "ledger requires at least genesis block");
    Self { blocks }
}
```

**crates/evolve-core/src/processor/facade.rs** — snapshot/restore:

```rust
/// Capture a snapshot of the persistable system state.
pub fn snapshot(&self, now: i64) -> Snapshot {
    Snapshot {
        version: "3.2.0".to_string(),
        created_at: now,
        l2_nodes: self.l2.nodes_vec(),
        l2_edges: self.l2.edges_map().clone(),
        l3_entries: self.l3.entries_vec(),
        l3_blocks: self.l3.ledger().blocks().to_vec(),
    }
}

/// Restore system state from a snapshot. Replaces L2 and L3 contents.
pub fn restore(&mut self, snapshot: Snapshot) {
    self.l2 = L2Graph::from_parts(snapshot.l2_nodes, snapshot.l2_edges);
    self.l3 = L3Vault::from_parts(
        snapshot.l3_entries,
        Ledger::from_blocks(snapshot.l3_blocks),
    );
}
```

### Unit Tests

- `crates/evolve-core/src/processor/tests.rs`
  - `test_snapshot_captures_l2_and_l3` — Encode data, snapshot, verify nodes/entries present
  - `test_restore_recovers_state` — Encode, snapshot, create new processor, restore, query succeeds
  - `test_restore_preserves_chain_integrity` — Restore snapshot, verify L3 chain is valid
  - `test_snapshot_excludes_l1` — Encode to L1, snapshot, verify L1 data not in snapshot

---

## Phase 3: File Persistence

Add `save_to_file()` and `load_from_file()` convenience methods using JSON serialization to disk.

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Add `save_to_file()`, `load_from_file()` methods
- `crates/evolve-core/src/processor/types.rs` — Add `PersistError` enum

### Changes

**crates/evolve-core/src/processor/types.rs** — error type:

```rust
#[derive(Debug, thiserror::Error)]
pub enum PersistError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serialize(#[from] serde_json::Error),
}
```

**crates/evolve-core/src/processor/facade.rs** — file operations:

```rust
use crate::processor::types::PersistError;

/// Save system state to a JSON file.
pub fn save_to_file(&self, path: &std::path::Path, now: i64) -> Result<(), PersistError> {
    let snapshot = self.snapshot(now);
    let json = serde_json::to_string_pretty(&snapshot)?;
    std::fs::write(path, json)?;
    Ok(())
}

/// Load system state from a JSON file, replacing L2 and L3 contents.
pub fn load_from_file(&mut self, path: &std::path::Path) -> Result<(), PersistError> {
    let json = std::fs::read_to_string(path)?;
    let snapshot: Snapshot = serde_json::from_str(&json)?;
    self.restore(snapshot);
    Ok(())
}
```

### Unit Tests

- `crates/evolve-core/src/processor/tests.rs`
  - `test_save_and_load_file` — Encode data, save to temp file, create new processor, load, query succeeds
  - `test_load_nonexistent_file` — Load from missing path returns Io error

---

## Summary

| Phase | Focus | New Files | Changes |
|-------|-------|-----------|---------|
| 1 | Serialization support + Snapshot type | 0 | 3 modified |
| 2 | Snapshot/restore on processor | 0 | 4 modified |
| 3 | File persistence | 0 | 2 modified |

### Design Principles Applied

1. **Simple over Easy**: JSON file — no new dependencies, human-inspectable, debuggable
2. **Values over State**: `Snapshot` is an immutable value captured at a point in time
3. **Composable**: `snapshot()`/`restore()` are independent of file I/O — can serialize to any format
4. **No complecting**: Serialization (Phase 1), state management (Phase 2), and I/O (Phase 3) are separate concerns
5. **Intentional exclusion**: L1 cache is explicitly not persisted — it's ephemeral by design

---

_Plan follows Simple Made Easy principles_
