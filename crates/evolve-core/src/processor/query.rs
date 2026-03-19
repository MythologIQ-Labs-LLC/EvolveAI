//! Extracted query helpers for the memory processor.
//!
//! These free functions implement the two retrieval paths:
//! 1. O(1) exact-match via L3 content addressing
//! 2. Vector-scan across all tiers with decay-aware scoring

use crate::memory::decoder::{self, DecoderConfig};
use crate::memory::types::*;
use crate::processor::types::{QueryResult, tier_list};
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Attempt an O(1) exact match against L3 via content-addressing.
///
/// Returns `Some(QueryResult)` with a single perfect-score hit if the
/// query content hashes to an existing L3 address, `None` otherwise.
pub fn try_l3_exact_match(
    l3: &L3Vault,
    content: &str,
    start: std::time::Instant,
) -> Option<QueryResult> {
    let query_address = UorAddress::from_content(content);
    let unit = l3.get_by_address(&query_address)?;
    let elapsed = start.elapsed().as_millis() as u64;

    Some(QueryResult {
        recall: RecallResult {
            memories: vec![ScoredMemory {
                unit: unit.clone(),
                relevance_score: 1.0,
                decayed_weight: 1.0,
            }],
            metrics: RecallMetrics {
                latency_ms: elapsed,
                tiers_queried: vec![Tier::L3],
                candidates_evaluated: 1,
                decay_filtered: 0,
            },
        },
        latency_ms: elapsed,
    })
}

/// Collect candidate memory units from the requested tiers.
pub fn collect_candidates<'a>(
    l1: &'a L1Cache,
    l2: &'a L2Graph,
    l3: &'a L3Vault,
    query: &Query,
    now: i64,
) -> Vec<&'a MemoryUnit> {
    match query.constraints.require_tier {
        Some(Tier::L1) => l1.iter_units(now).collect(),
        Some(Tier::L2) => l2.iter_units().collect(),
        Some(Tier::L3) => l3.iter_units().collect(),
        None => {
            let mut c: Vec<&MemoryUnit> = Vec::new();
            c.extend(l1.iter_units(now));
            c.extend(l2.iter_units());
            c.extend(l3.iter_units());
            c
        }
    }
}

/// Full vector-scan query: encode the query, gather candidates from
/// relevant tiers, score via the decoder, and return ranked results.
pub async fn vector_scan<E: RepresentationEngine>(
    engine: &E,
    decoder_config: &DecoderConfig,
    l1: &L1Cache,
    l2: &L2Graph,
    l3: &L3Vault,
    query: &Query,
    now: i64,
    start: std::time::Instant,
) -> Result<QueryResult, EngineError> {
    let rep = engine.encode(&query.content).await?;
    let query_embedding = rep.as_vector();
    let candidates = collect_candidates(l1, l2, l3, query, now);
    let tiers_queried = tier_list(query.constraints.require_tier);
    let total_candidates = candidates.len();

    let memories = decoder::decode(&candidates, &query_embedding, now, decoder_config);
    let decay_filtered = total_candidates - memories.len();
    let elapsed = start.elapsed().as_millis() as u64;

    Ok(QueryResult {
        recall: RecallResult {
            memories,
            metrics: RecallMetrics {
                latency_ms: elapsed,
                tiers_queried,
                candidates_evaluated: total_candidates,
                decay_filtered,
            },
        },
        latency_ms: elapsed,
    })
}
