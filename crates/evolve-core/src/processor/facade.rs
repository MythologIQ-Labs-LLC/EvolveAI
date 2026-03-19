use std::sync::Mutex;
use crate::lifecycle::orchestrator::{LifecycleError, Orchestrator};
use crate::lifecycle::types::Phase;
use crate::memory::encoder;
use crate::memory::types::*;
use crate::processor::persist;
use crate::processor::query as query_mod;
use crate::processor::ingest;
use crate::processor::profile::{self, CognitiveProfile};
use crate::processor::slo::{SloReport, SloSample, SloTracker};
use crate::processor::trust;
use crate::processor::types::{
    EncodeResult, PersistError, ProcessorConfig, ProcessorStats,
    QueryResult, Snapshot,
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
    session_log: Vec<(UorAddress, i64)>,
    slo_tracker: Mutex<SloTracker>,
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
            slo_tracker: Mutex::new(SloTracker::new(config.slo.clone())),
            config,
            session_log: Vec::new(),
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
            Tier::L2 => {
                self.l2.insert(unit.clone());
                self.l2.link_to_session(&unit.address, &self.session_log, now);
                self.pin_session_peers(&unit.address, now);
                self.session_log.push((unit.address.clone(), now));
            }
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
            if let Some(result) = query_mod::try_l3_exact_match(&self.l3, &query.content, start) {
                self.record_slo_sample(&result);
                return Ok(result);
            }
        }

        let result = query_mod::vector_scan(
            &self.engine,
            &self.config.decoder,
            &self.l1,
            &self.l2,
            &self.l3,
            query,
            now,
            start,
        )
        .await?;

        self.record_slo_sample(&result);
        Ok(result)
    }

    pub fn profile(&self, now: i64) -> CognitiveProfile {
        profile::compute(&self.l1, &self.l2, &self.l3, now, 10)
    }

    pub fn slo_report(&self) -> SloReport {
        self.slo_tracker.lock().unwrap().evaluate()
    }

    pub fn reset_slo(&self) {
        self.slo_tracker.lock().unwrap().reset_circuit();
    }

    fn record_slo_sample(&self, result: &QueryResult) {
        let was_l3_direct = result.recall.metrics.tiers_queried == vec![Tier::L3]
            && result.recall.metrics.candidates_evaluated == 1;
        self.slo_tracker.lock().unwrap().record(SloSample {
            latency_ms: result.latency_ms,
            was_l3_direct,
            chain_valid: self.l3.verify_integrity(),
        });
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

    pub fn clear_session(&mut self) {
        self.session_log.clear();
    }

    pub fn record_access(&mut self, addr: &UorAddress, event: PinningEvent) -> bool {
        trust::record_access(
            &mut self.l2, &mut self.l3, addr, event,
            self.config.crystallization,
        )
    }

    /// List L2 memories with σ≥0.95 awaiting crystallization approval.
    pub fn pending_crystallizations(&self) -> Vec<UorAddress> {
        self.l2.iter_units()
            .filter(|u| u.saturation >= 0.95)
            .map(|u| u.address.clone())
            .collect()
    }

    fn pin_session_peers(&mut self, _new_addr: &UorAddress, _now: i64) {
        trust::pin_session_peers(&mut self.l2, &self.session_log);
    }

    pub fn record_conflict(&mut self, addr: &UorAddress, severity: f32) -> Option<f32> {
        trust::record_conflict(&mut self.l2, &mut self.l3, addr, severity)
    }

    pub fn approve_crystallization(&mut self, addr: &UorAddress) -> bool {
        trust::approve_crystallization(&mut self.l2, &mut self.l3, addr)
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

    pub async fn ingest_file(
        &mut self, path: &std::path::Path, tags: Vec<String>, now: i64,
    ) -> Result<ingest::IngestResult, ingest::IngestError> {
        ingest::ingest_file(self, path, tags, &ingest::ChunkConfig::default(), now).await
    }

    pub fn forget(&mut self, addr: &UorAddress) -> bool {
        if self.l2.remove(addr).is_some() {
            return true;
        }
        if self.l3.remove(addr).is_some() {
            return true;
        }
        false
    }

    pub fn related(&self, addr: &UorAddress) -> Vec<&MemoryUnit> {
        self.l2.neighbors(addr)
    }

    pub fn association_count(&self, addr: &UorAddress) -> usize {
        self.l2.edges_from(addr).len()
    }
}
