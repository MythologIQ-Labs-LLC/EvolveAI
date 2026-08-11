use crate::state::AppProcessor;
use evolve_core::memory::types::*;
use evolve_core::shadow::interceptor::Verdict;
use serde::Serialize;
use tauri::State;
use tokio::sync::Mutex;

#[derive(Serialize)]
pub struct EncodeResponse {
    pub address: String,
    pub tier: String,
    pub mts_score: f32,
}

/// One ranked match from a query.
///
/// The core stores memories content-addressed (BLAKE3 address + embedding);
/// the raw text itself is never retained, so there is no `content` field —
/// the source and tags metadata are the human-readable handles.
#[derive(Serialize)]
pub struct QueryMatch {
    pub address: String,
    pub tier: String,
    /// Relevance score against the query embedding (1.0 = exact L3 match).
    pub score: f32,
    /// CMHL decay weight at query time.
    pub decayed_weight: f32,
    pub saturation: f32,
    pub source: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Serialize)]
pub struct QueryResponse {
    pub count: usize,
    pub candidates_evaluated: usize,
    pub latency_ms: u64,
    /// Ranked matches, best first (decoder top-k order).
    pub results: Vec<QueryMatch>,
}

#[derive(Serialize)]
pub struct SafetyResponse {
    pub passed: bool,
    pub reasoning: Option<String>,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub l1_size: usize,
    pub l2_nodes: usize,
    pub l2_edges: usize,
    pub l3_size: usize,
    pub l3_chain_length: usize,
    pub l3_integrity: bool,
    pub phase: String,
    pub trace_count: usize,
}

/// Truncate a string to at most `max` characters (char-boundary safe),
/// appending an ellipsis when anything was cut.
fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max).collect();
    out.push('…');
    out
}

#[tauri::command]
pub async fn encode_memory(
    content: String,
    tags: Vec<String>,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<EncodeResponse, String> {
    let input = RawInput {
        content,
        content_type: ContentType::Text,
        metadata: InputMetadata {
            tags,
            ..Default::default()
        },
    };
    let now = chrono::Utc::now().timestamp_millis();
    let mut proc = processor.lock().await;
    let result = proc.encode(&input, now).await.map_err(|e| e.to_string())?;
    crate::persistence::mark_dirty();
    Ok(EncodeResponse {
        address: result.unit.address.to_string(),
        tier: format!("{:?}", result.decision.tier),
        mts_score: result.decision.mts_score,
    })
}

#[tauri::command]
pub async fn query_memory(
    content: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<QueryResponse, String> {
    let query = Query {
        content,
        constraints: QueryConstraints::default(),
    };
    let now = chrono::Utc::now().timestamp_millis();
    let proc = processor.lock().await;
    let result = proc.query(&query, now).await.map_err(|e| e.to_string())?;
    let results: Vec<QueryMatch> = result
        .recall
        .memories
        .iter()
        .map(|m| QueryMatch {
            address: m.unit.address.to_string(),
            tier: format!("{:?}", m.unit.metadata.tier),
            score: m.relevance_score,
            decayed_weight: m.decayed_weight,
            saturation: m.unit.saturation,
            source: m.unit.metadata.source.as_ref().map(|s| truncate(s, 200)),
            tags: m.unit.metadata.tags.clone(),
        })
        .collect();
    Ok(QueryResponse {
        count: result.recall.memories.len(),
        candidates_evaluated: result.recall.metrics.candidates_evaluated,
        latency_ms: result.latency_ms,
        results,
    })
}

#[tauri::command]
pub async fn get_stats(processor: State<'_, Mutex<AppProcessor>>) -> Result<StatsResponse, String> {
    let proc = processor.lock().await;
    let s = proc.stats();
    Ok(StatsResponse {
        l1_size: s.l1_size,
        l2_nodes: s.l2_nodes,
        l2_edges: s.l2_edges,
        l3_size: s.l3_size,
        l3_chain_length: s.l3_chain_length,
        l3_integrity: s.l3_integrity,
        phase: format!("{:?}", s.phase),
        trace_count: s.trace_count,
    })
}

#[tauri::command]
pub async fn check_safety(
    intent: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<SafetyResponse, String> {
    let mut proc = processor.lock().await;
    let verdict = proc
        .check_safety(&intent)
        .await
        .map_err(|e| e.to_string())?;
    match verdict {
        Verdict::Pass => Ok(SafetyResponse {
            passed: true,
            reasoning: None,
        }),
        Verdict::Block { reasoning, .. } => Ok(SafetyResponse {
            passed: false,
            reasoning: Some(reasoning),
        }),
    }
}

#[tauri::command]
pub async fn health_check(processor: State<'_, Mutex<AppProcessor>>) -> Result<bool, String> {
    let proc = processor.lock().await;
    Ok(proc.health_check())
}

#[tauri::command]
pub async fn save_state(
    path: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let proc = processor.lock().await;
    proc.save_to_file(std::path::Path::new(&path), now)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_state(
    path: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<(), String> {
    let mut proc = processor.lock().await;
    proc.load_from_file(std::path::Path::new(&path))
        .map_err(|e| e.to_string())?;
    // The in-memory state changed; sync the default autosave file to it.
    crate::persistence::mark_dirty();
    Ok(())
}
