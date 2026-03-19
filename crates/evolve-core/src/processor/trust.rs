//! Zero-Trust Crystallization: policy-gated promotion and conflict handling.

use crate::memory::decay;
use crate::memory::types::{PinningEvent, UorAddress};
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;
use serde::{Deserialize, Serialize};

/// Controls whether L2->L3 promotion happens automatically or requires approval.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum CrystallizationPolicy {
    /// Promote automatically when saturation reaches threshold.
    Auto,
    /// Require explicit `approve_crystallization` call.
    #[default]
    RequireApproval,
}

const CRYSTALLIZATION_THRESHOLD: f32 = 0.95;

/// Record a pinning event, boosting saturation.
/// Auto-promotes L2->L3 only if `policy == Auto` and saturation >= 0.95.
pub fn record_access(
    l2: &mut L2Graph,
    l3: &mut L3Vault,
    addr: &UorAddress,
    event: PinningEvent,
    policy: CrystallizationPolicy,
) -> bool {
    if let Some(unit) = l2.get_mut(addr) {
        unit.saturation = decay::boost_saturation_weighted(unit.saturation, event);
        unit.access_count += 1;
        if policy == CrystallizationPolicy::Auto && unit.saturation >= CRYSTALLIZATION_THRESHOLD {
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

/// Record a conflict, injecting entropy to unpin fibers.
/// Returns the new saturation, or `None` if address not found.
pub fn record_conflict(
    l2: &mut L2Graph,
    l3: &mut L3Vault,
    addr: &UorAddress,
    severity: f32,
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

/// Explicitly approve crystallization (L2->L3 promotion).
/// Succeeds only if the unit exists in L2 with saturation >= 0.95.
pub fn approve_crystallization(
    l2: &mut L2Graph,
    l3: &mut L3Vault,
    addr: &UorAddress,
) -> bool {
    let dominated = l2
        .get_mut(addr)
        .map(|u| u.saturation >= CRYSTALLIZATION_THRESHOLD)
        .unwrap_or(false);
    if dominated {
        if let Some(promoted) = l2.remove(addr) {
            l3.store(promoted);
            return true;
        }
    }
    false
}

/// Pin session peers via `CrossReference` events.
pub fn pin_session_peers(
    l2: &mut L2Graph,
    session_log: &[(UorAddress, i64)],
) {
    for (peer_addr, _) in session_log {
        if let Some(unit) = l2.get_mut(peer_addr) {
            unit.saturation = decay::boost_saturation_weighted(
                unit.saturation,
                PinningEvent::CrossReference,
            );
        }
    }
}
