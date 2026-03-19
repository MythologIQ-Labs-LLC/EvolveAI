use crate::state::AppProcessor;
use evolve_core::memory::types::{PinningEvent, UorAddress};
use serde::Serialize;
use tauri::State;
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct FeedbackResponse {
    pub found: bool,
}

#[derive(Serialize)]
pub struct ProfileResponse {
    pub total_memories: usize,
    pub l1_count: usize,
    pub l2_count: usize,
    pub l3_count: usize,
    pub avg_saturation: f32,
    pub crystallized_count: usize,
    pub top_tags: Vec<(String, usize)>,
    pub summary: String,
}

#[derive(Serialize)]
pub struct SloResponse {
    pub violation_count: usize,
    pub budget_remaining: f32,
    pub circuit_open: bool,
    pub pressure: f32,
    pub adjusted_half_life_ms: i64,
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

fn parse_pinning_event(event: &str) -> Result<PinningEvent, String> {
    match event {
        "access" => Ok(PinningEvent::Access),
        "crossref" => Ok(PinningEvent::CrossReference),
        "corroboration" => Ok(PinningEvent::Corroboration),
        "crypto" => Ok(PinningEvent::CryptoVerification),
        other => Err(format!("unknown pinning event: {other}")),
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn feedback(
    address: String,
    event: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<FeedbackResponse, String> {
    let pin_event = parse_pinning_event(&event)?;
    let addr = UorAddress(address);
    let mut proc = processor.lock().await;
    let found = proc.record_access(&addr, pin_event);
    Ok(FeedbackResponse { found })
}

#[tauri::command]
pub async fn dispute(
    address: String,
    severity: f32,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<Option<f32>, String> {
    let addr = UorAddress(address);
    let mut proc = processor.lock().await;
    Ok(proc.record_conflict(&addr, severity))
}

#[tauri::command]
pub async fn approve_crystallization(
    address: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<bool, String> {
    let addr = UorAddress(address);
    let mut proc = processor.lock().await;
    Ok(proc.approve_crystallization(&addr))
}

#[tauri::command]
pub async fn forget_memory(
    address: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<bool, String> {
    let addr = UorAddress(address);
    let mut proc = processor.lock().await;
    Ok(proc.forget(&addr))
}

#[tauri::command]
pub async fn get_profile(
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<ProfileResponse, String> {
    let now = chrono::Utc::now().timestamp_millis();
    let proc = processor.lock().await;
    let p = proc.profile(now);
    Ok(ProfileResponse {
        summary: p.to_summary(),
        total_memories: p.total_memories,
        l1_count: p.l1_count,
        l2_count: p.l2_count,
        l3_count: p.l3_count,
        avg_saturation: p.avg_saturation,
        crystallized_count: p.crystallized_count,
        top_tags: p.top_tags,
    })
}

#[tauri::command]
pub async fn get_slo_report(
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<SloResponse, String> {
    let proc = processor.lock().await;
    let r = proc.slo_report();
    Ok(SloResponse {
        violation_count: r.violation_count,
        budget_remaining: r.budget_remaining,
        circuit_open: r.circuit_open,
        pressure: r.pressure,
        adjusted_half_life_ms: r.adjusted_half_life_ms,
    })
}

#[tauri::command]
pub async fn get_related(
    address: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<Vec<String>, String> {
    let addr = UorAddress(address);
    let proc = processor.lock().await;
    let addrs: Vec<String> = proc
        .related(&addr)
        .iter()
        .map(|u| u.address.to_string())
        .collect();
    Ok(addrs)
}

#[tauri::command]
pub async fn get_pending(
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<Vec<String>, String> {
    let proc = processor.lock().await;
    let addrs: Vec<String> = proc
        .pending_crystallizations()
        .iter()
        .map(|a| a.to_string())
        .collect();
    Ok(addrs)
}
