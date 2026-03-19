use crate::lifecycle::orchestrator::{LifecycleError, Orchestrator};
use crate::lifecycle::types::Phase;
use crate::memory::decay;
use crate::memory::decoder;
use crate::memory::encoder;
use crate::memory::types::*;
use crate::processor::persist;
use crate::processor::types::{
    EncodeResult, PersistError, ProcessorConfig, ProcessorStats,
    QueryResult, Snapshot, tier_list,
};
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::shadow::genome::ShadowGenome;
use crate::shadow::interceptor::{self, Verdict};
use crate::shadow::types::FailureTrace;
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Central facade for the autopoietic memory system.
pub struct MemoryProcessor<E: RepresentationEngine> {
    engine: E,
    config: ProcessorConfig,
    l1: L1Cache,
    l2: L2Graph,
    l3: L3Vault,
    shadow: ShadowGenome,
    lifecycle: Orchestrator,
}

impl<E: RepresentationEngine> MemoryProcessor<E> {
    /// Create a new processor with the given engine and config.
    pub fn new(engine: E, config: ProcessorConfig) -> Self {
        let lifecycle = Orchestrator::new(
            uuid::Uuid::new_v4().to_string(),
            config.lifecycle.clone(),
        );
        Self {
            l1: L1Cache::new(config.l1_ttl_ms, config.l1_max_size),
            l2: L2Graph::new(),
            l3: L3Vault::new(),
            shadow: ShadowGenome::default(),
            lifecycle,
            engine,
            config,
        }
    }

    pub fn start_session(&mut self, now: i64) -> Result<(), LifecycleError> {
        self.lifecycle.start_session(now)
    }

    pub fn phase(&self) -> Phase {
        self.lifecycle.phase()
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

        let allows_l3 = matches!(query.constraints.require_tier, None | Some(Tier::L3));
        if allows_l3 {
            if let Some(result) = self.try_l3_exact_match(&query.content, start) {
                return Ok(result);
            }
        }

        self.vector_scan_query(query, now, start).await
    }

    pub fn stats(&self) -> ProcessorStats {
        ProcessorStats {
            l1_size: self.l1.len(),
            l2_nodes: self.l2.node_count(),
            l2_edges: self.l2.edge_count(),
            l3_size: self.l3.len(),
            l3_chain_length: self.l3.ledger().len(),
            l3_integrity: self.l3.verify_integrity(),
            phase: self.lifecycle.phase(),
            trace_count: self.lifecycle.trace_count(),
        }
    }

    pub fn health_check(&self) -> bool {
        self.l3.verify_integrity()
    }

    pub async fn check_safety(&mut self, intent: &str) -> Result<Verdict, EngineError> {
        let rep = self.engine.encode(intent).await?;
        let embedding = rep.as_vector();
        Ok(interceptor::check_intent(&embedding, &mut self.shadow, &self.config.interceptor))
    }

    pub async fn record_failure(
        &mut self,
        trace: FailureTrace,
        now: i64,
    ) -> Result<(), EngineError> {
        let rep = self.engine.encode(&trace.intent).await?;
        self.shadow.ingest(trace, rep.as_vector(), now);
        Ok(())
    }

    /// Record a pinning event, boosting the memory's saturation.
    /// Searches L2 then L3 (L1 is ephemeral, not worth boosting).
    pub fn record_access(&mut self, addr: &UorAddress, event: PinningEvent) -> bool {
        if let Some(unit) = self.l2.get_mut(addr) {
            unit.saturation = decay::boost_saturation_weighted(unit.saturation, event);
            unit.access_count += 1;
            return true;
        }
        if let Some(unit) = self.l3.get_mut(addr) {
            unit.saturation = decay::boost_saturation_weighted(unit.saturation, event);
            unit.access_count += 1;
            return true;
        }
        false
    }

    /// Record a conflict, injecting entropy to unpin fibers.
    /// Returns the new saturation, or None if address not found.
    pub fn record_conflict(&mut self, addr: &UorAddress, severity: f32) -> Option<f32> {
        if let Some(unit) = self.l2.get_mut(addr) {
            unit.saturation = decay::inject_entropy(unit.saturation, severity);
            return Some(unit.saturation);
        }
        if let Some(unit) = self.l3.get_mut(addr) {
            unit.saturation = decay::inject_entropy(unit.saturation, severity);
            return Some(unit.saturation);
        }
        None
    }

    pub fn snapshot(&self, now: i64) -> Snapshot {
        persist::snapshot(&self.l2, &self.l3, &self.shadow, now)
    }

    pub fn restore(&mut self, snap: Snapshot) -> Result<(), PersistError> {
        persist::restore(&mut self.l2, &mut self.l3, &mut self.shadow, snap)
    }

    pub fn save_to_file(&self, path: &std::path::Path, now: i64) -> Result<(), PersistError> {
        persist::save_to_file(&self.l2, &self.l3, &self.shadow, path, now)
    }

    pub fn load_from_file(&mut self, path: &std::path::Path) -> Result<(), PersistError> {
        persist::load_from_file(&mut self.l2, &mut self.l3, &mut self.shadow, path)
    }

    // --- Private query helpers ---

    fn try_l3_exact_match(
        &self,
        content: &str,
        start: std::time::Instant,
    ) -> Option<QueryResult> {
        let query_address = UorAddress::from_content(content);
        let unit = self.l3.get_by_address(&query_address)?;
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

    async fn vector_scan_query(
        &self,
        query: &Query,
        now: i64,
        start: std::time::Instant,
    ) -> Result<QueryResult, EngineError> {
        let rep = self.engine.encode(&query.content).await?;
        let query_embedding = rep.as_vector();
        let candidates = self.collect_candidates(query, now);
        let tiers_queried = tier_list(query.constraints.require_tier);
        let total_candidates = candidates.len();

        let memories = decoder::decode(&candidates, &query_embedding, now, &self.config.decoder);
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

    fn collect_candidates(&self, query: &Query, now: i64) -> Vec<&MemoryUnit> {
        match query.constraints.require_tier {
            Some(Tier::L1) => self.l1.iter_units(now).collect(),
            Some(Tier::L2) => self.l2.iter_units().collect(),
            Some(Tier::L3) => self.l3.iter_units().collect(),
            None => {
                let mut c: Vec<&MemoryUnit> = Vec::new();
                c.extend(self.l1.iter_units(now));
                c.extend(self.l2.iter_units());
                c.extend(self.l3.iter_units());
                c
            }
        }
    }
}
