use crate::memory::decay::{calculate_decay, should_prune};
use crate::memory::types::*;
use crate::representation::similarity::cosine_similarity;

/// Decoder configuration.
#[derive(Clone, Debug)]
pub struct DecoderConfig {
    pub top_k: usize,
    pub decay_threshold: f32,
    pub half_life_ms: i64,
}

impl Default for DecoderConfig {
    fn default() -> Self {
        Self {
            top_k: 10,
            decay_threshold: 0.05,
            half_life_ms: 3_600_000,
        }
    }
}

/// Score a single memory unit against a query embedding.
fn score_unit(
    unit: &MemoryUnit,
    query_embedding: &[f32],
    now: i64,
    config: &DecoderConfig,
) -> Option<ScoredMemory> {
    let decayed_weight = calculate_decay(
        unit.last_accessed,
        now,
        config.half_life_ms,
        unit.saturation,
    );

    if should_prune(decayed_weight, config.decay_threshold) {
        return None;
    }

    let relevance_score = cosine_similarity(&unit.embedding, query_embedding);

    Some(ScoredMemory {
        unit: unit.clone(),
        relevance_score,
        decayed_weight,
    })
}

/// Score and rank candidate units against a query embedding.
///
/// Pure scoring function — caller provides candidates from relevant tiers.
pub fn decode(
    candidates: &[&MemoryUnit],
    query_embedding: &[f32],
    now: i64,
    config: &DecoderConfig,
) -> Vec<ScoredMemory> {
    let mut scored: Vec<ScoredMemory> = candidates
        .iter()
        .filter_map(|unit| score_unit(unit, query_embedding, now, config))
        .collect();

    scored.sort_by(|a, b| {
        let sa = a.relevance_score * a.decayed_weight;
        let sb = b.relevance_score * b.decayed_weight;
        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
    });

    scored.truncate(config.top_k);
    scored
}
