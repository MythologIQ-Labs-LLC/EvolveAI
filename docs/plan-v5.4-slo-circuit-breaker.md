# Plan: v5.4 SLO Evaluation & Circuit Breaker (BL-009)

## Open Questions

1. **Error budget window**: Should budget track violations over a rolling window (last N queries) or since last reset? This plan uses a rolling window (`window_size: usize`) — simpler than time-based, no clock dependency.

2. **Circuit breaker reset**: When the circuit opens, should it auto-close after conditions improve, or require manual reset? This plan requires manual `reset_circuit()` — auto-close complects monitoring with control.

---

## Phase 1: SLO Thresholds & Evaluation

### Affected Files

- `crates/evolve-core/src/processor/slo.rs` — **NEW**: SLO types + evaluation
- `crates/evolve-core/src/processor/mod.rs` — Add `slo` module
- `crates/evolve-core/src/processor/tests.rs` — SLO evaluation tests

### Changes

**processor/slo.rs** — **NEW** file:

```rust
/// Formal SLO thresholds for memory system reliability.
#[derive(Clone, Debug)]
pub struct SloThresholds {
    pub max_query_latency_ms: u64,      // Default: 50
    pub max_l3_latency_ms: u64,         // Default: 1 (O(1) lookups)
    pub chain_integrity_required: bool,  // Default: true
    pub max_violation_rate: f32,         // Default: 0.01 (1% error budget)
    pub window_size: usize,             // Default: 100
}

/// A single SLO measurement from a query.
#[derive(Clone, Debug)]
pub struct SloSample {
    pub latency_ms: u64,
    pub was_l3_direct: bool,
    pub chain_valid: bool,
}

/// SLO evaluation result.
#[derive(Clone, Debug)]
pub struct SloReport {
    pub violations: Vec<SloViolation>,
    pub total_samples: usize,
    pub violation_count: usize,
    pub violation_rate: f32,
    pub budget_remaining: f32,
    pub circuit_open: bool,
}

/// A specific SLO violation.
#[derive(Clone, Debug)]
pub enum SloViolation {
    LatencyExceeded { actual_ms: u64, limit_ms: u64 },
    L3LatencyExceeded { actual_ms: u64, limit_ms: u64 },
    ChainIntegrityFailed,
}

/// Rolling window SLO tracker.
pub struct SloTracker {
    thresholds: SloThresholds,
    samples: Vec<SloSample>,
    circuit_open: bool,
}
```

Core methods on `SloTracker`:

```rust
impl SloTracker {
    pub fn new(thresholds: SloThresholds) -> Self { ... }

    /// Record a query sample and evaluate SLO compliance.
    pub fn record(&mut self, sample: SloSample) -> SloReport {
        self.samples.push(sample);
        if self.samples.len() > self.thresholds.window_size {
            self.samples.remove(0);
        }
        self.evaluate()
    }

    /// Evaluate current window against thresholds.
    pub fn evaluate(&self) -> SloReport {
        let mut violations = Vec::new();
        let mut violation_count = 0_usize;

        for s in &self.samples {
            let mut violated = false;
            if s.was_l3_direct && s.latency_ms > self.thresholds.max_l3_latency_ms {
                violations.push(SloViolation::L3LatencyExceeded {
                    actual_ms: s.latency_ms,
                    limit_ms: self.thresholds.max_l3_latency_ms,
                });
                violated = true;
            } else if !s.was_l3_direct && s.latency_ms > self.thresholds.max_query_latency_ms {
                violations.push(SloViolation::LatencyExceeded {
                    actual_ms: s.latency_ms,
                    limit_ms: self.thresholds.max_query_latency_ms,
                });
                violated = true;
            }
            if self.thresholds.chain_integrity_required && !s.chain_valid {
                violations.push(SloViolation::ChainIntegrityFailed);
                violated = true;
            }
            if violated { violation_count += 1; }
        }

        let total = self.samples.len();
        let rate = if total > 0 { violation_count as f32 / total as f32 } else { 0.0 };
        let budget = (self.thresholds.max_violation_rate - rate)
            / self.thresholds.max_violation_rate;

        SloReport {
            violations,
            total_samples: total,
            violation_count,
            violation_rate: rate,
            budget_remaining: budget.max(0.0),
            circuit_open: self.circuit_open || budget <= 0.0,
        }
    }

    /// Manually reset the circuit breaker.
    pub fn reset_circuit(&mut self) {
        self.circuit_open = false;
        self.samples.clear();
    }
}
```

**processor/mod.rs** — add `pub mod slo;`

### Unit Tests

- `processor/tests.rs`
  - `test_slo_clean_window_no_violations` — 10 fast queries, all within limits: violation_count = 0, budget = 1.0
  - `test_slo_latency_violation_detected` — Insert one slow sample (100ms with 50ms limit): violation found
  - `test_slo_l3_latency_violation_detected` — L3 direct query at 5ms (limit 1ms): L3-specific violation
  - `test_slo_chain_integrity_violation` — Sample with chain_valid=false: ChainIntegrityFailed violation
  - `test_slo_budget_exhausted_opens_circuit` — Push violation_rate past max_violation_rate: circuit_open = true
  - `test_slo_rolling_window_drops_oldest` — Add window_size+1 samples, first is dropped
  - `test_slo_reset_circuit_clears_state` — After reset, circuit_open = false, samples empty

---

## Phase 2: Processor Integration

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Add SloTracker field, record samples after queries
- `crates/evolve-core/src/processor/types.rs` — Add `slo` field to ProcessorConfig
- `crates/evolve-core/src/simple.rs` — Expose `slo_report()` on SimpleMemory
- `crates/evolve-core/src/processor/tests.rs` — Integration tests

### Changes

**processor/types.rs** — add SLO config to ProcessorConfig:

```rust
pub struct ProcessorConfig {
    // ... existing fields
    pub slo: SloThresholds,
}
```

**processor/facade.rs** — add `slo_tracker: SloTracker` field, record samples after `query()`:

In `query()`, after getting the result, before returning:

```rust
let was_l3_direct = result.recall.metrics.tiers_queried == vec![Tier::L3]
    && result.recall.metrics.candidates_evaluated == 1;
self.slo_tracker.record(SloSample {
    latency_ms: result.latency_ms,
    was_l3_direct,
    chain_valid: self.l3.verify_integrity(),
});
```

Add `slo_report()` method:

```rust
pub fn slo_report(&self) -> SloReport {
    self.slo_tracker.evaluate()
}

pub fn reset_slo(&mut self) {
    self.slo_tracker.reset_circuit();
}
```

**simple.rs** — add convenience:

```rust
pub fn slo_report(&self) -> crate::processor::slo::SloReport {
    self.processor.slo_report()
}
```

**Note**: `query()` currently takes `&self`. Adding SLO recording requires `&mut self` for the tracker. To avoid this API change, use interior mutability: `slo_tracker: RefCell<SloTracker>`. This keeps `query(&self)` unchanged.

### Unit Tests

- `processor/tests.rs`
  - `test_processor_query_records_slo_sample` — Encode + query, then slo_report shows total_samples > 0
  - `test_processor_slo_circuit_blocks_query` — Exhaust budget, verify circuit_open in report (caller decides whether to act on it)

- `simple.rs` (inline test)
  - `test_simple_slo_report` — SimpleMemory::slo_report() returns a valid report after queries

---

## Summary

| Phase | Focus | New Functions | New Tests |
|-------|-------|---------------|-----------|
| 1 | SLO Types + Evaluation | `SloTracker::new`, `record`, `evaluate`, `reset_circuit` | 7 |
| 2 | Processor Integration | `slo_report`, `reset_slo`, sample recording in query | 3 |

### Design Principles Applied

1. **Values over State**: `SloReport` is an immutable value. `SloSample` is a value. `SloViolation` is a value. The tracker holds minimal rolling-window state.
2. **No complecting**: SLO evaluation (slo.rs) is independent of query execution (query.rs). The processor composes them — records samples after queries, returns reports on demand.
3. **Declarative**: `SloThresholds` declares WHAT the targets are. `evaluate()` derives violations. The caller decides HOW to act on violations.
4. **Simple over Easy**: The circuit breaker is manual-reset. No auto-recovery, no retry logic, no backoff. The caller reads the report and decides.

---

_Plan follows Simple Made Easy principles_
