# Plan: v6.0 Thermodynamic Lifecycle Proof

## Open Questions

None. This plan adds tests only — no production code changes.

---

## Phase 1: End-to-End Integration Test

### Affected Files

- `crates/evolve-core/tests/thermodynamic_lifecycle.rs` — **NEW**: full lifecycle proof
- `crates/evolve-core/tests/zero_trust.rs` — **NEW**: zero-trust crystallization proof

### Changes

**tests/thermodynamic_lifecycle.rs** — **NEW** integration test. Proves the complete self-optimization loop from the UOR research draft:

```
Encode → Co-capture Link → CrossReference Pin → σ Rises →
Approve Crystallization → O(1) Lookup → Dispute → Entropy Spike →
Evaporation → Profile Reflects Changes → SLO Reports Pressure
```

Single test function, ~60 lines, exercising every thermodynamic primitive in sequence:

```rust
#[tokio::test]
async fn test_complete_thermodynamic_lifecycle() {
    // 1. Create memory with Unverified trust (σ₀ = 0.0)
    // 2. Encode 3 memories in same session → co-capture edges created
    // 3. Verify: edge_count > 0, CrossReference pins boosted peer σ
    // 4. Record CryptoVerification events → σ rises toward 0.95
    // 5. With RequireApproval: memory stays in L2 despite σ ≥ 0.95
    // 6. Approve crystallization → memory promotes to L3
    // 7. Query by exact content → O(1) L3 match (tiers_queried = [L3], candidates = 1)
    // 8. Dispute the memory → entropy injection → σ drops
    // 9. With enough time elapsed + low σ, decay weight < threshold → prunable
    // 10. Profile shows crystallized_count, avg_saturation, top_tags
    // 11. SLO report shows pressure and adjusted_half_life
}
```

**tests/zero_trust.rs** — **NEW** integration test. Proves zero-trust properties:

```rust
#[tokio::test]
async fn test_unverified_content_requires_more_evidence() {
    // Unverified (σ₀=0.0) vs Verified (σ₀=0.3): Verified crystallizes faster
}

#[tokio::test]
async fn test_crystallization_guard_prevents_hallucination_permanence() {
    // With RequireApproval: LLM-generated content cannot auto-crystallize
    // Even after 100 CryptoVerification events, memory stays in L2
    // Only explicit approve_crystallization() moves to L3
}

#[tokio::test]
async fn test_disputed_memory_evaporates() {
    // Encode → boost to high σ → dispute with severity 0.8 → σ drops
    // Memory becomes prunable — the system self-heals from bad data
}

#[tokio::test]
async fn test_forget_removes_crystallized_memory() {
    // Even L3 (λ=0) memories can be explicitly deleted
    // Proves permanence is about decay resistance, not undeletability
}
```

### Unit Tests

These ARE the tests — integration tests in the `tests/` directory at crate level.

- `test_complete_thermodynamic_lifecycle` — The single test that proves the entire UOR draft
- `test_unverified_content_requires_more_evidence` — Provenance affects crystallization speed
- `test_crystallization_guard_prevents_hallucination_permanence` — Zero-trust default
- `test_disputed_memory_evaporates` — Self-healing via entropy injection
- `test_forget_removes_crystallized_memory` — Explicit deletion overrides permanence

---

## Phase 2: UOR Research Draft Update

### Affected Files

- `docs/Research/UOR-GITHUB-ISSUE-DRAFT.md` — Add "Reference Implementation" section

### Changes

Append a section at the bottom (before "Prior Art") documenting the working implementation:

```markdown
## Reference Implementation

EvolveAI (v5.0–v5.9) implements this proposal as a working Rust library:

| Theoretical Claim | Implementation | Test |
|---|---|---|
| BLAKE3 content-addressing | `UorAddress::from_content()` | `test_blake3_deterministic` |
| σ=1 → zero decay | `calculate_decay(σ=1.0)` returns 1.0 | `test_decay_saturated_memory_no_decay` |
| Weighted fiber pinning | `PinningEvent` enum (4 tiers) | `test_crypto_verification_pins_faster_than_access` |
| Entropy injection (heating) | `inject_entropy(σ, severity)` | `test_entropy_accelerates_decay` |
| O(1) crystallized lookup | `try_l3_exact_match()` fast path | `test_l3_address_lookup_o1` |
| Self-optimization loop | encode → link → pin → promote → O(1) | `test_complete_thermodynamic_lifecycle` |
| Hardware-aware λ_base | `pressure_adjusted_half_life()` | `test_adjusted_half_life_decreases_under_pressure` |

201 tests, 47 source files. Apache-2.0 licensed.
```

---

## Summary

| Phase | Focus | New Tests |
|-------|-------|-----------|
| 1 | Integration tests (lifecycle + zero-trust) | 5 |
| 2 | Research draft update (documentation only) | 0 |

### Design Principles Applied

1. **Proof over promise**: The integration tests exercise the complete thermodynamic lifecycle end-to-end. One test proves the thesis.
2. **No production changes**: v6.0 adds only tests and documentation. The system is feature-complete.

---

_Plan follows Simple Made Easy principles_
