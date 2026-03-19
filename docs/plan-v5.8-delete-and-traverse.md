# Plan: v5.8 Memory Deletion & Graph Traversal

## Open Questions

1. **L3 deletion**: Should crystallized memories (L3, λ=0) be deletable? They were designed as permanent. This plan allows it — the caller made a deliberate decision, and the chain records the event. Permanence is about decay resistance, not undeletability.

2. **Cascade delete**: When deleting an L2 memory, should its edges be cleaned up? Yes — `L2Graph::remove()` already handles this (both directions).

---

## Phase 1: Memory Deletion

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Add `forget()` method
- `crates/evolve-core/src/simple/mod.rs` — Add `forget()` convenience
- `crates/evolve-core/src/processor/tests.rs` — Deletion tests
- `crates/evolve-core/src/simple/tests.rs` — SimpleMemory deletion test

### Changes

**processor/facade.rs** — add method (+8 lines, 235 → 243):

```rust
/// Delete a memory from any tier. Returns true if found and removed.
pub fn forget(&mut self, addr: &UorAddress) -> bool {
    if self.l2.remove(addr).is_some() {
        return true;
    }
    if self.l3.remove(addr).is_some() {
        return true;
    }
    false
}
```

Note: `L3Vault` needs a `remove()` method — it doesn't have one yet.

**tiers/l3_vault.rs** — add method:

```rust
/// Remove an entry. Returns the unit if found.
pub(crate) fn remove(&mut self, addr: &UorAddress) -> Option<MemoryUnit> {
    self.entries.remove(addr)
}
```

`pub(crate)` consistent with `store()` — only internal code can modify L3.

**simple/mod.rs** — add method:

```rust
pub fn forget(&mut self, addr: &UorAddress) -> bool {
    self.processor.forget(addr)
}
```

### Unit Tests

- `processor/tests.rs`
  - `test_forget_removes_from_l2` — Encode to L2, forget, verify l2_nodes decreases
  - `test_forget_removes_from_l3` — Encode sensitive to L3, forget, verify l3_size decreases
  - `test_forget_not_found` — Forget nonexistent address returns false
  - `test_forget_cleans_edges` — Encode 2 linked memories, forget one, verify edge cleanup

- `simple/tests.rs`
  - `test_simple_forget` — add + forget + search returns empty

---

## Phase 2: Graph Traversal

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Add `related()` method
- `crates/evolve-core/src/simple/mod.rs` — Add `related()` convenience
- `crates/evolve-core/src/processor/tests.rs` — Traversal tests
- `crates/evolve-core/src/simple/tests.rs` — SimpleMemory traversal test

### Changes

**processor/facade.rs** — add method (+7 lines, 243 → 250):

```rust
/// Get memories directly associated with the given address via L2 graph edges.
pub fn related(&self, addr: &UorAddress) -> Vec<&MemoryUnit> {
    self.l2.neighbors(addr)
}

/// Get the number of associations for a memory.
pub fn association_count(&self, addr: &UorAddress) -> usize {
    self.l2.edges_from(addr).len()
}
```

**simple/mod.rs** — add methods:

```rust
pub fn related(&self, addr: &UorAddress) -> Vec<&MemoryUnit> {
    self.processor.related(addr)
}
```

### Unit Tests

- `processor/tests.rs`
  - `test_related_returns_neighbors` — Encode 3 memories in session, verify related() returns co-captured peers
  - `test_related_empty_for_isolated` — Encode with cleared session, verify related() returns empty
  - `test_association_count` — Encode 3 in session, verify association_count > 0

- `simple/tests.rs`
  - `test_simple_related` — add 2 facts in session, verify related() returns the peer

---

## Summary

| Phase | Focus | New Functions | New Tests |
|-------|-------|---------------|-----------|
| 1 | Memory Deletion | `forget()` on facade + simple, `remove()` on L3Vault | 5 |
| 2 | Graph Traversal | `related()`, `association_count()` on facade + simple | 4 |

### Design Principles Applied

1. **Simple over Easy**: `forget()` is a single method that searches all tiers. No need for `forget_from_l2()` / `forget_from_l3()` variants.
2. **Values over State**: `related()` returns borrowed references — no copies, no handles.
3. **No complecting**: Deletion (facade.forget) is independent of traversal (facade.related). Both delegate to existing tier methods.
4. **Consistent access control**: L3Vault::remove() is `pub(crate)` — same as `store()`. External code uses the processor facade.

---

_Plan follows Simple Made Easy principles_
