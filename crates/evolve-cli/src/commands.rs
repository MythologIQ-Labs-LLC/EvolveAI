//! Command handlers. Every command acquires the state lock (exclusive for
//! mutating commands, shared for read-only ones) before touching
//! `memory.json`, and mutating commands run an automatic decay tick right
//! before saving so the stores keep metabolizing.

use crate::exchange;
use crate::lock;
use crate::paths;
use evolve_core::lifecycle::orchestrator::LifecycleError;
use evolve_core::memory::types::{PinningEvent, UorAddress};
use evolve_core::processor::facade::MemoryProcessor;
use evolve_core::processor::metabolism::DecayTickReport;
use evolve_core::processor::types::ProcessorConfig;
use evolve_core::representation::mock::MockEngine;
use evolve_core::simple::{SimpleMemory, SimpleMemoryConfig};
use std::collections::HashSet;
use std::fs::File;
use std::path::PathBuf;

/// Exit with an error message.
fn die(msg: &str) -> ! {
    eprintln!("error: {msg}");
    std::process::exit(1);
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Open the state lock file, exiting on failure.
fn take_lock() -> fd_lock::RwLock<File> {
    match lock::open(&paths::lock_file()) {
        Ok(l) => l,
        Err(e) => die(&format!("cannot open lock file: {e}")),
    }
}

fn guard(l: &mut fd_lock::RwLock<File>, mode: lock::Mode) -> lock::Guard<'_> {
    match lock::acquire(l, mode) {
        Ok(g) => g,
        Err(e) => die(&format!("cannot acquire lock: {e}")),
    }
}

fn load_memory() -> SimpleMemory {
    let mut mem = SimpleMemory::new();
    let path = paths::state_file();
    if path.exists() {
        if let Err(e) = mem.load_from_file(&path) {
            eprintln!("warn: failed to load state: {e}");
        }
    }
    mem
}

fn load_processor() -> MemoryProcessor<MockEngine> {
    let dims = SimpleMemoryConfig::default().dimensions;
    let mut proc = MemoryProcessor::new(MockEngine::new(dims), ProcessorConfig::default());
    let path = paths::state_file();
    if path.exists() {
        if let Err(e) = proc.load_from_file(&path) {
            eprintln!("warn: failed to load state: {e}");
        }
    }
    proc
}

fn save_processor(proc: &MemoryProcessor<MockEngine>) {
    let dir = paths::state_dir();
    if let Err(e) = std::fs::create_dir_all(&dir) {
        die(&format!("cannot create {}: {e}", dir.display()));
    }
    if let Err(e) = proc.save_to_file(&paths::state_file(), now_ms()) {
        die(&format!("failed to save state: {e}"));
    }
}

/// Automatic metabolism at the end of every mutating command: run one decay
/// tick, report to stderr only when something actually changed, then save.
fn tick_and_save(proc: &mut MemoryProcessor<MockEngine>) {
    let report = proc.run_decay_tick(now_ms());
    let changed = report.l1_evicted + report.l2_pruned + report.l2_promoted;
    if changed > 0 {
        eprintln!(
            "metabolism: evicted {} from L1, pruned {} from L2, promoted {} to L3",
            report.l1_evicted, report.l2_pruned, report.l2_promoted
        );
    }
    save_processor(proc);
}

fn save_memory_with_tick(mem: SimpleMemory) {
    let mut proc = mem.into_processor();
    tick_and_save(&mut proc);
}

// ---------------------------------------------------------------------------
// Existing commands (now lock-guarded)
// ---------------------------------------------------------------------------

pub async fn cmd_add(args: &[String]) {
    if args.is_empty() {
        die("add requires content");
    }
    let content = args.join(" ");
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut mem = load_memory();
    match mem.add(&content).await {
        Ok(addr) => {
            println!("{}", addr.0);
            save_memory_with_tick(mem);
        }
        Err(e) => die(&e.to_string()),
    }
}

pub async fn cmd_search(args: &[String]) {
    if args.is_empty() {
        die("search requires a query");
    }
    let query = args.join(" ");
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Shared);
    let mem = load_memory();
    match mem.search(&query, 10).await {
        Ok(results) => {
            if results.is_empty() {
                println!("(no results)");
            }
            for r in &results {
                println!(
                    "{:.2}  {}  (\u{03c3}={:.2})",
                    r.relevance_score, r.unit.address.0, r.unit.saturation
                );
            }
        }
        Err(e) => die(&e.to_string()),
    }
}

pub fn cmd_forget(args: &[String]) {
    if args.is_empty() {
        die("forget requires an address");
    }
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut mem = load_memory();
    let addr = UorAddress(args[0].clone());
    if mem.forget(&addr) {
        println!("forgotten: {}", addr.0);
        save_memory_with_tick(mem);
    } else {
        die(&format!("not found: {}", addr.0));
    }
}

pub fn cmd_feedback(args: &[String]) {
    if args.is_empty() {
        die("feedback requires an address");
    }
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut mem = load_memory();
    let addr = UorAddress(args[0].clone());
    if mem.feedback(&addr, PinningEvent::CrossReference) {
        println!("pinned: {}", addr.0);
        save_memory_with_tick(mem);
    } else {
        die(&format!("not found: {}", addr.0));
    }
}

pub fn cmd_dispute(args: &[String]) {
    if args.is_empty() {
        die("dispute requires an address");
    }
    let severity: f32 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(0.5);
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut mem = load_memory();
    let addr = UorAddress(args[0].clone());
    match mem.dispute(&addr, severity) {
        Some(new_sat) => {
            println!("disputed: {} -> \u{03c3}={:.2}", addr.0, new_sat);
            save_memory_with_tick(mem);
        }
        None => die(&format!("not found: {}", addr.0)),
    }
}

pub fn cmd_approve(args: &[String]) {
    if args.is_empty() {
        die("approve requires an address");
    }
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut mem = load_memory();
    let addr = UorAddress(args[0].clone());
    if mem.approve_crystallization(&addr) {
        println!("crystallized: {}", addr.0);
        save_memory_with_tick(mem);
    } else {
        die(&format!("not eligible or not found: {}", addr.0));
    }
}

pub fn cmd_profile() {
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Shared);
    let mem = load_memory();
    println!("{}", mem.profile().to_summary());
}

pub fn cmd_slo() {
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Shared);
    let mem = load_memory();
    let report = mem.slo_report();
    println!("Pressure:         {:.2}", report.pressure);
    println!("Budget remaining: {:.2}", report.budget_remaining);
    println!(
        "Circuit:          {}",
        if report.circuit_open {
            "OPEN"
        } else {
            "closed"
        }
    );
    println!(
        "Violations:       {}/{}",
        report.violation_count, report.total_samples
    );
    println!("Half-life (adj):  {} ms", report.adjusted_half_life_ms);
}

pub async fn cmd_ingest(args: &[String]) {
    if args.is_empty() {
        die("ingest requires a file path");
    }
    let path = PathBuf::from(&args[0]);
    if !path.exists() {
        die(&format!("file not found: {}", path.display()));
    }
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut mem = load_memory();
    match mem.add_file(&path).await {
        Ok(result) => {
            println!("ingested: {} ({} chunks)", result.source, result.chunks);
            for addr in &result.addresses {
                println!("  {}", addr.0);
            }
            save_memory_with_tick(mem);
        }
        Err(e) => die(&e.to_string()),
    }
}

// ---------------------------------------------------------------------------
// Metabolism commands
// ---------------------------------------------------------------------------

fn print_tick_report(report: &DecayTickReport) {
    println!("decay tick:");
    println!(
        "  L1: examined {}, evicted {}",
        report.l1_examined, report.l1_evicted
    );
    println!(
        "  L2: examined {}, pruned {}, promoted {}",
        report.l2_examined, report.l2_pruned, report.l2_promoted
    );
    println!("  L3: examined {} (never pruned)", report.l3_examined);
}

pub fn cmd_tick() {
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut proc = load_processor();
    let report = proc.run_decay_tick(now_ms());
    print_tick_report(&report);
    save_processor(&proc);
}

pub fn cmd_detach() {
    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut proc = load_processor();
    match proc.detach(now_ms()) {
        Ok(report) => {
            if report.synthesized {
                println!(
                    "detached: REM synthesis consolidated {} traces",
                    report.traces_processed
                );
                if let Some(decay) = &report.decay {
                    print_tick_report(decay);
                }
            } else {
                println!("detached: below synthesis threshold, no consolidation needed");
            }
            save_processor(&proc);
        }
        Err(LifecycleError::InvalidPhase { .. }) => {
            println!("nothing to detach: no activity recorded in this invocation (system is idle)");
        }
    }
}

// ---------------------------------------------------------------------------
// Memory exchange commands
// ---------------------------------------------------------------------------

pub fn cmd_export(args: &[String]) {
    let mut out: Option<PathBuf> = None;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--out" => {
                i += 1;
                match args.get(i) {
                    Some(p) => out = Some(PathBuf::from(p)),
                    None => die("--out requires a path"),
                }
            }
            other => die(&format!("unknown export argument '{other}'")),
        }
        i += 1;
    }

    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Shared);
    let proc = load_processor();
    let now = now_ms();
    let snap = proc.snapshot(now);
    let chain_verified = proc.health_check();
    let slo = proc.slo_report();
    let envelope =
        match exchange::build_envelope(&snap, &slo, chain_verified, now, env!("CARGO_PKG_VERSION"))
        {
            Ok(env) => env,
            Err(e) => die(&e),
        };
    let json = match serde_json::to_string_pretty(&envelope) {
        Ok(j) => j,
        Err(e) => die(&format!("failed to serialize envelope: {e}")),
    };
    match out {
        Some(path) => {
            if let Err(e) = std::fs::write(&path, json + "\n") {
                die(&format!("cannot write {}: {e}", path.display()));
            }
            eprintln!(
                "exported {} memories to {}",
                envelope.memories.len(),
                path.display()
            );
        }
        None => println!("{json}"),
    }
}

pub async fn cmd_import(args: &[String]) {
    let mut path: Option<PathBuf> = None;
    let mut mode = "propose".to_string();
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--mode" => {
                i += 1;
                match args.get(i) {
                    Some(m) => mode = m.clone(),
                    None => die("--mode requires a value"),
                }
            }
            other if path.is_none() && !other.starts_with('-') => {
                path = Some(PathBuf::from(other));
            }
            other => die(&format!("unknown import argument '{other}'")),
        }
        i += 1;
    }
    let path = match path {
        Some(p) => p,
        None => die("import requires an envelope path"),
    };
    if mode != "propose" {
        die(&format!(
            "unsupported import mode '{mode}' (only 'propose' exists: imports always enter as proposals)"
        ));
    }

    let text = match std::fs::read_to_string(&path) {
        Ok(t) => t,
        Err(e) => die(&format!("cannot read {}: {e}", path.display())),
    };
    let envelope = match exchange::parse_and_validate(&text) {
        Ok(env) => env,
        Err(e) => die(&format!("envelope rejected: {e}")),
    };

    let mut l = take_lock();
    let _g = guard(&mut l, lock::Mode::Exclusive);
    let mut proc = load_processor();
    match apply_import(&mut proc, &envelope).await {
        Ok((inserted, duplicates, edges)) => {
            println!(
                "imported: {} proposals into L2 ({} duplicates skipped, {} edges) from {} units",
                inserted,
                duplicates,
                edges,
                envelope.memories.len()
            );
            tick_and_save(&mut proc);
        }
        Err(e) => die(&format!("envelope rejected: {e}")),
    }
}

/// Insert validated envelope units as L2 proposals via a snapshot merge.
/// Returns (inserted, duplicates_skipped, edges_imported).
async fn apply_import(
    proc: &mut MemoryProcessor<MockEngine>,
    envelope: &exchange::Envelope,
) -> Result<(usize, usize, usize), String> {
    let now = now_ms();
    let dims = SimpleMemoryConfig::default().dimensions;
    let engine = MockEngine::new(dims);

    let snap = proc.snapshot(now);
    let mut l2_nodes = snap.l2_nodes;
    let mut l2_edges = snap.l2_edges;

    let mut present: HashSet<String> = l2_nodes.iter().map(|u| u.address.0.clone()).collect();
    let l3_present: HashSet<String> = snap
        .l3_entries
        .iter()
        .map(|u| u.address.0.clone())
        .collect();

    let mut inserted: HashSet<String> = HashSet::new();
    let mut duplicates = 0usize;
    for unit in &envelope.memories {
        if present.contains(&unit.address) || l3_present.contains(&unit.address) {
            duplicates += 1;
            continue;
        }
        // Content-bearing units get a locally computed embedding (identity
        // already BLAKE3-verified); content-null units are references and
        // carry a null (zero) embedding that never matches vector search.
        let embedding = match &unit.content {
            Some(content) => {
                use evolve_core::representation::engine::RepresentationEngine;
                engine
                    .encode(content)
                    .await
                    .map_err(|e| format!("embedding failed: {e}"))?
                    .as_vector()
            }
            None => vec![0.0; dims],
        };
        let local = exchange::to_proposal_unit(unit, embedding, now);
        l2_edges.entry(local.address.clone()).or_default();
        present.insert(local.address.0.clone());
        inserted.insert(local.address.0.clone());
        l2_nodes.push(local);
    }

    // Associative edges are imported only between units that now exist in
    // L2 (imported or pre-existing); dangling targets are dropped.
    let mut edges_imported = 0usize;
    for unit in &envelope.memories {
        if !inserted.contains(&unit.address) {
            continue;
        }
        for edge in unit.edges.iter().flatten() {
            if !present.contains(&edge.target) {
                continue;
            }
            let created_at = edge
                .created_at
                .as_deref()
                .and_then(|s| exchange::parse_rfc3339_ms(s).ok())
                .unwrap_or(now);
            l2_edges
                .entry(UorAddress(unit.address.clone()))
                .or_default()
                .push(evolve_core::tiers::l2_graph::Edge {
                    target: UorAddress(edge.target.clone()),
                    weight: edge.weight,
                    created_at,
                });
            edges_imported += 1;
        }
    }

    let count = inserted.len();
    let merged = evolve_core::processor::types::Snapshot {
        version: snap.version,
        created_at: now,
        l2_nodes,
        l2_edges,
        l3_entries: snap.l3_entries,
        l3_blocks: snap.l3_blocks,
        shadow_entries: snap.shadow_entries,
    };
    proc.restore(merged)
        .map_err(|e| format!("restore after import failed: {e}"))?;
    Ok((count, duplicates, edges_imported))
}
