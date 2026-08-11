//! v3 command surface: file ingestion and metabolic maintenance —
//! decay tick, detach (REM-synthesis consolidation), Shadow Genome stats.

use crate::state::AppProcessor;
use evolve_core::lifecycle::orchestrator::LifecycleError;
use evolve_core::processor::metabolism::{DecayTickReport, DetachReport};
use serde::Serialize;
use tauri::State;
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct IngestResponse {
    pub source: String,
    pub chunks: usize,
    pub addresses: Vec<String>,
}

#[derive(Serialize)]
pub struct DecayTickResponse {
    pub l1_examined: usize,
    pub l1_evicted: usize,
    pub l2_examined: usize,
    pub l2_pruned: usize,
    pub l2_promoted: usize,
    /// L3 units seen by the tick. Never pruned: vault forgetting is
    /// explicit-only (forget / dispute).
    pub l3_examined: usize,
}

impl From<DecayTickReport> for DecayTickResponse {
    fn from(r: DecayTickReport) -> Self {
        Self {
            l1_examined: r.l1_examined,
            l1_evicted: r.l1_evicted,
            l2_examined: r.l2_examined,
            l2_pruned: r.l2_pruned,
            l2_promoted: r.l2_promoted,
            l3_examined: r.l3_examined,
        }
    }
}

#[derive(Serialize)]
pub struct DetachResponse {
    pub synthesized: bool,
    pub traces_processed: usize,
    pub decay: Option<DecayTickResponse>,
}

impl From<DetachReport> for DetachResponse {
    fn from(r: DetachReport) -> Self {
        Self {
            synthesized: r.synthesized,
            traces_processed: r.traces_processed,
            decay: r.decay.map(DecayTickResponse::from),
        }
    }
}

#[derive(Serialize)]
pub struct ShadowStatsResponse {
    pub total_entries: usize,
    pub active_entries: usize,
    pub total_triggers: u64,
    /// Entry counts per failure category (Debug names, e.g.
    /// "IntegrationFailure"), most frequent first.
    pub by_category: Vec<(String, usize)>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ingest_file(
    path: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<IngestResponse, String> {
    let now = chrono::Utc::now().timestamp_millis();
    let mut proc = processor.lock().await;
    let result = proc
        .ingest_file(std::path::Path::new(&path), Vec::new(), now)
        .await
        .map_err(|e| e.to_string())?;
    crate::persistence::mark_dirty();
    Ok(IngestResponse {
        source: result.source,
        chunks: result.chunks,
        addresses: result.addresses.iter().map(|a| a.to_string()).collect(),
    })
}

#[tauri::command]
pub async fn run_decay_tick(
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<DecayTickResponse, String> {
    let now = chrono::Utc::now().timestamp_millis();
    let mut proc = processor.lock().await;
    let report = proc.run_decay_tick(now);
    crate::persistence::mark_dirty();
    Ok(report.into())
}

#[tauri::command]
pub async fn detach(processor: State<'_, Mutex<AppProcessor>>) -> Result<DetachResponse, String> {
    let now = chrono::Utc::now().timestamp_millis();
    let mut proc = processor.lock().await;
    let report = proc.detach(now).map_err(|e| match e {
        LifecycleError::InvalidPhase { actual, .. } => {
            format!("nothing to detach: lifecycle phase is {actual:?} (detach requires ActiveFlow)")
        }
    })?;
    crate::persistence::mark_dirty();
    Ok(report.into())
}

#[tauri::command]
pub async fn get_shadow_stats(
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<ShadowStatsResponse, String> {
    let proc = processor.lock().await;
    let s = proc.shadow_stats();
    Ok(ShadowStatsResponse {
        total_entries: s.total_entries,
        active_entries: s.active_entries,
        total_triggers: s.total_triggers,
        by_category: s
            .by_category
            .iter()
            .map(|(cat, n)| (format!("{cat:?}"), *n))
            .collect(),
    })
}
