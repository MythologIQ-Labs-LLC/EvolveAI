use evolve_core::memory::types::{PinningEvent, UorAddress};
use evolve_core::simple::SimpleMemory;
use std::path::PathBuf;

fn state_dir() -> PathBuf {
    let base = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(base).join(".evolve")
}

fn state_file() -> PathBuf {
    state_dir().join("memory.json")
}

fn load_memory() -> SimpleMemory {
    let mut mem = SimpleMemory::new();
    let path = state_file();
    if path.exists() {
        if let Err(e) = mem.load_from_file(&path) {
            eprintln!("warn: failed to load state: {e}");
        }
    }
    mem
}

fn save_memory(mem: &SimpleMemory) {
    let dir = state_dir();
    if !dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&dir) {
            eprintln!("error: cannot create {}: {e}", dir.display());
            return;
        }
    }
    if let Err(e) = mem.save_to_file(&state_file()) {
        eprintln!("error: failed to save state: {e}");
    }
}

fn print_usage() {
    let usage = "\
EvolveAI CLI v6.1.0

Usage: evolve-cli <command> [args...]

Commands:
  add <content...>           Store a memory, print its address
  search <query...>          Find memories by relevance
  forget <address>           Delete a memory by address
  feedback <address>         Pin fibers (CrossReference event)
  dispute <address> [sev]    Inject entropy (default severity 0.5)
  approve <address>          Approve crystallization (L2->L3)
  profile                    Show cognitive profile summary
  slo                        Show SLO report
  ingest <file>              Ingest a text file as memory chunks
  help                       Show this message";
    println!("{usage}");
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        print_usage();
        return;
    }

    match args[0].as_str() {
        "help" | "--help" | "-h" => print_usage(),
        "add" => cmd_add(&args[1..]).await,
        "search" => cmd_search(&args[1..]).await,
        "forget" => cmd_forget(&args[1..]),
        "feedback" => cmd_feedback(&args[1..]),
        "dispute" => cmd_dispute(&args[1..]),
        "approve" => cmd_approve(&args[1..]),
        "profile" => cmd_profile(),
        "slo" => cmd_slo(),
        "ingest" => cmd_ingest(&args[1..]).await,
        other => {
            eprintln!("error: unknown command '{other}'");
            eprintln!("Run 'evolve-cli help' for usage.");
            std::process::exit(1);
        }
    }
}

async fn cmd_add(args: &[String]) {
    if args.is_empty() {
        eprintln!("error: add requires content");
        std::process::exit(1);
    }
    let content = args.join(" ");
    let mut mem = load_memory();
    match mem.add(&content).await {
        Ok(addr) => {
            println!("{}", addr.0);
            save_memory(&mem);
        }
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}

async fn cmd_search(args: &[String]) {
    if args.is_empty() {
        eprintln!("error: search requires a query");
        std::process::exit(1);
    }
    let query = args.join(" ");
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
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}

fn cmd_forget(args: &[String]) {
    if args.is_empty() {
        eprintln!("error: forget requires an address");
        std::process::exit(1);
    }
    let mut mem = load_memory();
    let addr = UorAddress(args[0].clone());
    if mem.forget(&addr) {
        println!("forgotten: {}", addr.0);
        save_memory(&mem);
    } else {
        eprintln!("not found: {}", addr.0);
        std::process::exit(1);
    }
}

fn cmd_feedback(args: &[String]) {
    if args.is_empty() {
        eprintln!("error: feedback requires an address");
        std::process::exit(1);
    }
    let mut mem = load_memory();
    let addr = UorAddress(args[0].clone());
    if mem.feedback(&addr, PinningEvent::CrossReference) {
        println!("pinned: {}", addr.0);
        save_memory(&mem);
    } else {
        eprintln!("not found: {}", addr.0);
        std::process::exit(1);
    }
}

fn cmd_dispute(args: &[String]) {
    if args.is_empty() {
        eprintln!("error: dispute requires an address");
        std::process::exit(1);
    }
    let severity: f32 = args.get(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.5);
    let mut mem = load_memory();
    let addr = UorAddress(args[0].clone());
    match mem.dispute(&addr, severity) {
        Some(new_sat) => {
            println!("disputed: {} -> \u{03c3}={:.2}", addr.0, new_sat);
            save_memory(&mem);
        }
        None => {
            eprintln!("not found: {}", addr.0);
            std::process::exit(1);
        }
    }
}

fn cmd_approve(args: &[String]) {
    if args.is_empty() {
        eprintln!("error: approve requires an address");
        std::process::exit(1);
    }
    let mut mem = load_memory();
    let addr = UorAddress(args[0].clone());
    if mem.approve_crystallization(&addr) {
        println!("crystallized: {}", addr.0);
        save_memory(&mem);
    } else {
        eprintln!("not eligible or not found: {}", addr.0);
        std::process::exit(1);
    }
}

fn cmd_profile() {
    let mem = load_memory();
    println!("{}", mem.profile().to_summary());
}

fn cmd_slo() {
    let mem = load_memory();
    let report = mem.slo_report();
    println!("Pressure:         {:.2}", report.pressure);
    println!("Budget remaining: {:.2}", report.budget_remaining);
    println!(
        "Circuit:          {}",
        if report.circuit_open { "OPEN" } else { "closed" }
    );
    println!("Violations:       {}/{}", report.violation_count, report.total_samples);
    println!("Half-life (adj):  {} ms", report.adjusted_half_life_ms);
}

async fn cmd_ingest(args: &[String]) {
    if args.is_empty() {
        eprintln!("error: ingest requires a file path");
        std::process::exit(1);
    }
    let path = PathBuf::from(&args[0]);
    if !path.exists() {
        eprintln!("error: file not found: {}", path.display());
        std::process::exit(1);
    }
    let mut mem = load_memory();
    match mem.add_file(&path).await {
        Ok(result) => {
            println!("ingested: {} ({} chunks)", result.source, result.chunks);
            for addr in &result.addresses {
                println!("  {}", addr.0);
            }
            save_memory(&mem);
        }
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
