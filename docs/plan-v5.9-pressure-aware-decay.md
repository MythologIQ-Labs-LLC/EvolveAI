# Plan: v5.9 Pressure-Aware Decay (Hardware-Aware λ_base)

## Open Questions

1. **Pressure source**: What constitutes "memory pressure"? This plan uses tier utilization (L1 size / max_size + L2 node count / configurable max) as the pressure signal. No OS-level metrics — pure memory-system introspection.

2. **Automatic vs manual**: Should pressure adjustment be automatic (SLO triggers it) or manual (caller sets it)? This plan provides both — `calculate_pressure()` is a pure function, `apply_pressure()` on the facade adjusts decoder config.

---

## Phase 1: Pressure Computation

### Affected Files

- `crates/evolve-core/src/processor/slo.rs` — Add pressure calculation + pressure-adjusted half-life
- `crates/evolve-core/src/processor/types.rs` — Add pressure config to ProcessorConfig
- `crates/evolve-core/src/processor/tests.rs` — Pressure tests

### Changes

**processor/slo.rs** — add types + function (slo.rs at 135, +30 = ~165, under 250):

```rust
/// Memory pressure configuration.
#[derive(Clone, Debug)]
pub struct PressureConfig {
    pub l2_capacity: usize,   // Default: 10_000
    pub pressure_curve: f32,  // Default: 2.0 (quadratic)
}

impl Default for PressureConfig {
    fn default() -> Self {
        Self { l2_capacity: 10_000, pressure_curve: 2.0 }
    }
}

/// Compute memory pressure from tier utilization. Returns 0.0–1.0.
pub fn calculate_pressure(l1_size: usize, l1_max: usize, l2_size: usize, l2_capacity: usize) -> f32 {
    let l1_util = if l1_max > 0 { l1_size as f32 / l1_max as f32 } else { 0.0 };
    let l2_util = if l2_capacity > 0 { l2_size as f32 / l2_capacity as f32 } else { 0.0 };
    l1_util.max(l2_util).min(1.0)
}

/// Adjust half-life based on pressure. Higher pressure = shorter half-life = faster decay.
/// adjusted = base_half_life / (1.0 + pressure^curve)
pub fn pressure_adjusted_half_life(base_ms: i64, pressure: f32, curve: f32) -> i64 {
    let divisor = 1.0 + pressure.clamp(0.0, 1.0).powf(curve);
    (base_ms as f32 / divisor).max(1.0) as i64
}
```

**processor/types.rs** — add to ProcessorConfig (types.rs at 105, +2 = 107):

```rust
pub pressure: PressureConfig,
```

### Unit Tests

- `processor/tests.rs`
  - `test_pressure_zero_when_empty` — Empty tiers: pressure = 0.0
  - `test_pressure_increases_with_utilization` — 50% L2 fill: pressure = 0.5
  - `test_pressure_capped_at_one` — Overfull: pressure = 1.0
  - `test_adjusted_half_life_decreases_under_pressure` — pressure=0.9, curve=2.0: half_life significantly shorter
  - `test_adjusted_half_life_unchanged_at_zero_pressure` — pressure=0.0: no change

---

## Phase 2: Facade Integration (zero new facade lines)

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Modify existing `record_slo_sample` to include pressure
- `crates/evolve-core/src/processor/slo.rs` — Add `pressure` field to SloReport
- `crates/evolve-core/src/simple/mod.rs` — No change (slo_report already returns SloReport)

### Changes

The key insight: **no new facade methods needed**. The existing `slo_report()` already returns `SloReport`. Add `pressure: f32` and `adjusted_half_life_ms: i64` to `SloReport`. The `record_slo_sample` method (already called on every query) computes pressure from current tier sizes.

**processor/slo.rs** — add fields to SloReport:

```rust
pub struct SloReport {
    // ... existing fields
    pub pressure: f32,
    pub adjusted_half_life_ms: i64,
}
```

Update `evaluate()` to accept tier stats and compute pressure.

**processor/facade.rs** — modify `record_slo_sample` (no new lines, modify existing):

Pass `self.l1.len()`, `self.config.l1_max_size`, `self.l2.node_count()`, `self.config.pressure.l2_capacity` to the SLO tracker for pressure computation.

### Unit Tests

- `processor/tests.rs`
  - `test_slo_report_includes_pressure` — After encoding many memories, slo_report().pressure > 0.0
  - `test_pressure_adjusts_half_life_in_report` — Under pressure, adjusted_half_life_ms < base half_life

---

## Summary

| Phase | Focus | New Functions | New Tests |
|-------|-------|---------------|-----------|
| 1 | Pressure Computation | `calculate_pressure`, `pressure_adjusted_half_life`, `PressureConfig` | 5 |
| 2 | Integration | pressure + adjusted_half_life in SloReport | 2 |

### Design Principles Applied

1. **No complecting**: Pressure computation (slo.rs) is a pure function. It doesn't modify decay behavior — it reports what the adjusted half-life WOULD be. The caller decides whether to act.
2. **Zero facade growth**: No new methods on facade. Pressure is reported through the existing SloReport value.
3. **Values over State**: `calculate_pressure` and `pressure_adjusted_half_life` are pure functions of their inputs. No mutable state.
4. **Composable**: The caller reads `slo_report().adjusted_half_life_ms` and can pass it to `calculate_decay()` if they want pressure-aware queries. The system doesn't force this.

---

_Plan follows Simple Made Easy principles_
