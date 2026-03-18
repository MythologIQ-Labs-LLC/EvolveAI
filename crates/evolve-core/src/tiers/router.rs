use crate::memory::types::{MemoryUnit, Tier};

/// MTS (Memory Tier Score) weights for routing decisions.
#[derive(Clone, Debug)]
pub struct MtsWeights {
    pub sensitivity: f32,
    pub accuracy: f32,
    pub privilege: f32,
    pub compute: f32,
}

impl Default for MtsWeights {
    fn default() -> Self {
        Self {
            sensitivity: 0.4,
            accuracy: 0.3,
            privilege: 0.2,
            compute: 0.1,
        }
    }
}

/// Tier boundary thresholds.
#[derive(Clone, Debug)]
pub struct TierThresholds {
    pub l3: f32,
    pub l2: f32,
}

impl Default for TierThresholds {
    fn default() -> Self {
        Self { l3: 0.75, l2: 0.3 }
    }
}

/// Result of a tier routing decision.
#[derive(Clone, Debug)]
pub struct RouteDecision {
    pub tier: Tier,
    pub mts_score: f32,
    pub factors: MtsFactors,
}

/// Individual factor scores used to compute the MTS.
#[derive(Clone, Debug, Default)]
pub struct MtsFactors {
    pub sensitivity: f32,
    pub accuracy: f32,
    pub privilege: f32,
    pub compute: f32,
}

/// Route a memory unit to the appropriate tier based on MTS scoring.
pub fn route_memory_unit(
    unit: &MemoryUnit,
    weights: &MtsWeights,
    thresholds: &TierThresholds,
) -> RouteDecision {
    let factors = calculate_factors(unit);
    let mts_score = calculate_mts(&factors, weights);
    let tier = determine_tier(mts_score, thresholds);
    RouteDecision {
        tier,
        mts_score,
        factors,
    }
}

fn calculate_factors(unit: &MemoryUnit) -> MtsFactors {
    let has_sensitive = unit.metadata.tags.iter().any(|t| t == "sensitive");
    MtsFactors {
        sensitivity: if has_sensitive { 1.0 } else { 0.2 },
        accuracy: 0.5,
        privilege: if has_sensitive { 1.0 } else { 0.3 },
        compute: (unit.embedding.len() as f32 / 1000.0).min(1.0),
    }
}

fn calculate_mts(factors: &MtsFactors, weights: &MtsWeights) -> f32 {
    factors.sensitivity * weights.sensitivity
        + factors.accuracy * weights.accuracy
        + factors.privilege * weights.privilege
        + factors.compute * weights.compute
}

fn determine_tier(score: f32, thresholds: &TierThresholds) -> Tier {
    if score >= thresholds.l3 {
        Tier::L3
    } else if score >= thresholds.l2 {
        Tier::L2
    } else {
        Tier::L1
    }
}
