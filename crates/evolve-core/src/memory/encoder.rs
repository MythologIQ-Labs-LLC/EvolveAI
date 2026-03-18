use crate::chain::hash;
use crate::memory::types::*;
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::tiers::router::{route_memory_unit, MtsWeights, TierThresholds};
use uuid::Uuid;

/// Encoder configuration.
#[derive(Clone, Debug)]
pub struct EncoderConfig {
    pub default_decay_factor: f32,
    pub mts_weights: MtsWeights,
    pub tier_thresholds: TierThresholds,
}

impl Default for EncoderConfig {
    fn default() -> Self {
        Self {
            default_decay_factor: 1.0,
            mts_weights: MtsWeights::default(),
            tier_thresholds: TierThresholds::default(),
        }
    }
}

/// Encode raw input into a routed MemoryUnit.
///
/// Pipeline: embed → hash → route → assemble
pub async fn encode<E: RepresentationEngine>(
    input: &RawInput,
    engine: &E,
    config: &EncoderConfig,
    now: i64,
) -> Result<MemoryUnit, EngineError> {
    let rep = engine.encode(&input.content).await?;
    let embedding = rep.as_vector();
    let content_hash = hash::sha256(&input.content);

    let mut unit = MemoryUnit {
        uor_id: Uuid::new_v4(),
        embedding,
        content_hash,
        created_at: now,
        last_accessed: now,
        access_count: 0,
        decay_factor: config.default_decay_factor,
        metadata: UnitMetadata {
            tags: input.metadata.tags.clone(),
            source: input.metadata.source.clone(),
            tier: Tier::L1,
            mts_score: 0.0,
        },
    };

    let decision = route_memory_unit(&unit, &config.mts_weights, &config.tier_thresholds);
    unit.metadata.tier = decision.tier;
    unit.metadata.mts_score = decision.mts_score;

    Ok(unit)
}
