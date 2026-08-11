//! Metabolic maintenance: the decay tick that actually forgets.
//!
//! `should_prune` alone only *suppresses* decayed memories at query time.
//! This module performs the physical side of forgetting during an explicit
//! tick (invoked by callers or by REM synthesis via the facade):
//!
//! - L1: evict expired entries beyond insert-time eviction.
//! - L2: remove units whose CMHL decay weight fell below the prune
//!   threshold, respecting the weighted pinning hierarchy (saturation slows
//!   decay) and sparing crystallization candidates (σ ≥ 0.95) entirely.
//!   Removal also cleans the unit's graph edges.
//! - L2→L3 promotion (v5.2 rule): saturated units promote during the tick
//!   *only* under `CrystallizationPolicy::Auto`; under `RequireApproval`
//!   they wait for explicit approval (zero-trust doctrine — learned signals
//!   propose, never self-authorize).
//! - L3: never pruned. Vault forgetting stays explicit via forget/dispute.

use crate::memory::decay::{calculate_decay, should_prune};
use crate::memory::types::UorAddress;
use crate::processor::trust::{CrystallizationPolicy, CRYSTALLIZATION_THRESHOLD};
use crate::shadow::types::Severity;
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Report from a single decay tick.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DecayTickReport {
    /// L1 entries present before TTL eviction.
    pub l1_examined: usize,
    /// L1 entries evicted because their TTL elapsed.
    pub l1_evicted: usize,
    /// L2 units examined.
    pub l2_examined: usize,
    /// L2 units removed because their decay weight fell below threshold.
    pub l2_pruned: usize,
    /// L2 units promoted to L3 (Auto policy only).
    pub l2_promoted: usize,
    /// L3 units examined. Always spared: L3 forgetting is explicit-only.
    pub l3_examined: usize,
}

/// Report from a facade `detach()` call.
#[derive(Clone, Debug)]
pub struct DetachReport {
    /// Whether the trace count reached the synthesis threshold and the
    /// REM-synthesis consolidation pass ran.
    pub synthesized: bool,
    /// Number of pipeline traces consumed by synthesis (0 when not run).
    pub traces_processed: usize,
    /// Decay-tick report from the consolidation pass, if synthesis ran.
    pub decay: Option<DecayTickReport>,
}

/// Run one decay tick over the tiers. See module docs for semantics.
pub fn run_decay_tick(
    l1: &mut L1Cache,
    l2: &mut L2Graph,
    l3: &mut L3Vault,
    policy: CrystallizationPolicy,
    half_life_ms: i64,
    decay_threshold: f32,
    now: i64,
) -> DecayTickReport {
    let l1_examined = l1.len();
    l1.evict_expired(now);
    let l1_evicted = l1_examined - l1.len();

    let l2_examined = l2.node_count();
    let mut promote: Vec<UorAddress> = Vec::new();
    let mut prune: Vec<UorAddress> = Vec::new();
    for unit in l2.iter_units() {
        if unit.saturation >= CRYSTALLIZATION_THRESHOLD {
            // Crystallization candidates are never pruned. Under Auto they
            // promote now; under RequireApproval they wait for approval.
            if policy == CrystallizationPolicy::Auto {
                promote.push(unit.address.clone());
            }
            continue;
        }
        let weight = calculate_decay(unit.last_accessed, now, half_life_ms, unit.saturation);
        if should_prune(weight, decay_threshold) {
            prune.push(unit.address.clone());
        }
    }

    let mut l2_promoted = 0;
    for addr in promote {
        if let Some(unit) = l2.remove(&addr) {
            match l3.store(unit.clone()) {
                Ok(()) => l2_promoted += 1,
                // Vault rejected the unit (non-finite values): keep it in
                // L2 rather than losing it.
                Err(_) => l2.insert(unit),
            }
        }
    }

    // `L2Graph::remove` also drops the unit's outgoing edge list and every
    // edge targeting it, so pruning leaves no dangling associations.
    let mut l2_pruned = 0;
    for addr in prune {
        if l2.remove(&addr).is_some() {
            l2_pruned += 1;
        }
    }

    DecayTickReport {
        l1_examined,
        l1_evicted,
        l2_examined,
        l2_pruned,
        l2_promoted,
        l3_examined: l3.len(),
    }
}

/// Map a dispute severity (0.0–1.0 entropy injection) onto the shadow
/// genome's severity scale. Non-finite input maps to `Low`, mirroring
/// `decay::inject_entropy`'s treatment of non-finite severity as no-op.
pub fn dispute_severity(severity: f32) -> Severity {
    if !severity.is_finite() {
        return Severity::Low;
    }
    if severity >= 0.75 {
        Severity::Critical
    } else if severity >= 0.5 {
        Severity::High
    } else if severity >= 0.25 {
        Severity::Medium
    } else {
        Severity::Low
    }
}
