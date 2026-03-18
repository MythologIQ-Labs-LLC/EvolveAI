use crate::memory::decoder::{self, DecoderConfig};
use crate::memory::encoder::{self, EncoderConfig};
use crate::memory::types::*;
use crate::processor::types::*;
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Configuration for the memory processor.
#[derive(Clone, Debug)]
pub struct ProcessorConfig {
    pub encoder: EncoderConfig,
    pub decoder: DecoderConfig,
    pub l1_ttl_ms: i64,
    pub l1_max_size: usize,
}

impl Default for ProcessorConfig {
    fn default() -> Self {
        Self {
            encoder: EncoderConfig::default(),
            decoder: DecoderConfig::default(),
            l1_ttl_ms: 300_000,
            l1_max_size: 1000,
        }
    }
}

/// Central facade for the autopoietic memory system.
///
/// Generic over `E` to avoid object-safety issues with RPITIT.
pub struct MemoryProcessor<E: RepresentationEngine> {
    engine: E,
    config: ProcessorConfig,
    l1: L1Cache,
    l2: L2Graph,
    l3: L3Vault,
}

impl<E: RepresentationEngine> MemoryProcessor<E> {
    /// Create a new processor with the given engine and config.
    pub fn new(engine: E, config: ProcessorConfig) -> Self {
        Self {
            l1: L1Cache::new(config.l1_ttl_ms, config.l1_max_size),
            l2: L2Graph::new(),
            l3: L3Vault::new(),
            engine,
            config,
        }
    }

    /// Encode raw input and store in the appropriate tier.
    pub async fn encode(
        &mut self,
        input: &RawInput,
        now: i64,
    ) -> Result<EncodeResult, EngineError> {
        let unit = encoder::encode(input, &self.engine, &self.config.encoder, now).await?;
        let decision = crate::tiers::router::route_memory_unit(
            &unit,
            &self.config.encoder.mts_weights,
            &self.config.encoder.tier_thresholds,
        );

        match decision.tier {
            Tier::L1 => self.l1.insert(unit.clone(), now),
            Tier::L2 => self.l2.insert(unit.clone()),
            Tier::L3 => self.l3.store(unit.clone()),
        }

        Ok(EncodeResult { unit, decision })
    }

    /// Query across tiers and return scored results.
    pub async fn query(
        &self,
        query: &Query,
        now: i64,
    ) -> Result<QueryResult, EngineError> {
        let start = std::time::Instant::now();

        let rep = self.engine.encode(&query.content).await?;
        let query_embedding = rep.as_vector();

        let candidates: Vec<&MemoryUnit> = self.collect_candidates(query, now);
        let tiers_queried = tier_list(query.constraints.require_tier);
        let total_candidates = candidates.len();

        let memories = decoder::decode(
            &candidates,
            &query_embedding,
            now,
            &self.config.decoder,
        );

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

    /// Get system statistics.
    pub fn stats(&self) -> ProcessorStats {
        ProcessorStats {
            l1_size: self.l1.len(),
            l2_nodes: self.l2.node_count(),
            l2_edges: self.l2.edge_count(),
            l3_size: self.l3.len(),
            l3_chain_length: self.l3.ledger().len(),
            l3_integrity: self.l3.verify_integrity(),
        }
    }

    /// Health check — verifies L3 chain integrity.
    pub fn health_check(&self) -> bool {
        self.l3.verify_integrity()
    }

    fn collect_candidates(&self, query: &Query, now: i64) -> Vec<&MemoryUnit> {
        let mut candidates: Vec<&MemoryUnit> = Vec::new();
        match query.constraints.require_tier {
            Some(Tier::L1) => candidates.extend(self.l1.iter_units(now)),
            Some(Tier::L2) => candidates.extend(self.l2.iter_units()),
            Some(Tier::L3) => candidates.extend(self.l3.iter_units()),
            None => {
                candidates.extend(self.l1.iter_units(now));
                candidates.extend(self.l2.iter_units());
                candidates.extend(self.l3.iter_units());
            }
        }
        candidates
    }
}

fn tier_list(require: Option<Tier>) -> Vec<Tier> {
    match require {
        Some(t) => vec![t],
        None => vec![Tier::L1, Tier::L2, Tier::L3],
    }
}
