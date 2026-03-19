# Plan: v6.1 Tauri Commands Update + CLI Tool

## Open Questions

1. **CLI binary location**: This plan creates `crates/evolve-cli/` as a new workspace member. Should it be a separate binary crate or a `[[bin]]` in evolve-core? Separate crate is cleaner — the CLI depends on evolve-core, not the other way around.

2. **CLI state file**: Where should the CLI store its memory state? This plan defaults to `~/.evolve/memory.json`. Configurable via `--state` flag.

---

## Phase 1: Tauri Commands Update (v5.7+ features)

### Affected Files

- `src-tauri/src/commands.rs` — Add 8 new commands for trust, crystallization, profile, SLO, delete, traverse, ingest, feedback
- `src-tauri/src/main.rs` — Register new commands

### Changes

**commands.rs** — fix InputMetadata (add `..Default::default()` for trust field), then add new commands:

```rust
// New response types
#[derive(Serialize)]
pub struct ProfileResponse { ... }   // from CognitiveProfile

#[derive(Serialize)]
pub struct SloResponse { ... }       // from SloReport

#[derive(Serialize)]
pub struct FeedbackResponse { pub found: bool, pub event: String }

#[derive(Serialize)]
pub struct IngestResponse { pub source: String, pub chunks: usize }

// New commands
#[tauri::command] pub async fn feedback(...) -> Result<FeedbackResponse, String>
#[tauri::command] pub async fn dispute(...) -> Result<Option<f32>, String>
#[tauri::command] pub async fn approve_crystallization(...) -> Result<bool, String>
#[tauri::command] pub async fn forget_memory(...) -> Result<bool, String>
#[tauri::command] pub async fn get_profile(...) -> Result<ProfileResponse, String>
#[tauri::command] pub async fn get_slo_report(...) -> Result<SloResponse, String>
#[tauri::command] pub async fn get_related(...) -> Result<Vec<String>, String>
#[tauri::command] pub async fn ingest_file(...) -> Result<IngestResponse, String>
```

**main.rs** — register all new commands in `generate_handler![]`.

### Unit Tests

- No unit tests — Tauri commands are integration-tested via the frontend.

---

## Phase 2: CLI Binary

### Affected Files

- `crates/evolve-cli/Cargo.toml` — **NEW**: CLI binary crate
- `crates/evolve-cli/src/main.rs` — **NEW**: CLI entry point
- `Cargo.toml` (workspace) — Add `evolve-cli` to members

### Changes

**Cargo.toml (workspace)** — add to members:
```toml
members = ["crates/*", "src-tauri"]
```
(Already includes `crates/*`, so just creating the directory is sufficient.)

**crates/evolve-cli/Cargo.toml**:
```toml
[package]
name = "evolve-cli"
version = "6.1.0"
edition = "2021"

[dependencies]
evolve-core = { path = "../evolve-core" }
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
chrono = "0.4"
serde_json = "1"
```

No CLI framework dependency — use plain `std::env::args()` for simplicity. The CLI has ~10 subcommands, each 5-10 lines. A framework would be overkill.

**crates/evolve-cli/src/main.rs** — subcommand dispatcher:

```rust
use evolve_core::simple::SimpleMemory;
use evolve_core::memory::types::{PinningEvent, TrustLevel};

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let cmd = args.get(1).map(String::as_str).unwrap_or("help");

    let state_path = std::path::Path::new(&dirs());
    let mut mem = load_or_create(state_path);

    match cmd {
        "add" => cmd_add(&mut mem, &args[2..]).await,
        "search" => cmd_search(&mem, &args[2..]).await,
        "forget" => cmd_forget(&mut mem, &args[2..]),
        "feedback" => cmd_feedback(&mut mem, &args[2..]),
        "dispute" => cmd_dispute(&mut mem, &args[2..]),
        "approve" => cmd_approve(&mut mem, &args[2..]),
        "profile" => cmd_profile(&mem),
        "slo" => cmd_slo(&mem),
        "ingest" => cmd_ingest(&mut mem, &args[2..]).await,
        "help" | _ => cmd_help(),
    }

    save(state_path, &mem);
}
```

Each subcommand is a small function:

```rust
async fn cmd_add(mem: &mut SimpleMemory, args: &[String]) {
    let content = args.join(" ");
    let addr = mem.add(&content).await.unwrap();
    println!("{}", addr);
}

async fn cmd_search(mem: &SimpleMemory, args: &[String]) {
    let query = args.join(" ");
    let results = mem.search(&query, 5).await.unwrap();
    for r in &results {
        println!("{:.2}  {}", r.relevance_score, r.unit.address);
    }
}

fn cmd_profile(mem: &SimpleMemory) {
    println!("{}", mem.profile().to_summary());
}

fn cmd_help() {
    println!("evolve-cli <command> [args]");
    println!("  add <content>       Store a memory");
    println!("  search <query>      Find relevant memories");
    println!("  forget <address>    Delete a memory");
    println!("  feedback <address>  Pin fibers (CrossReference)");
    println!("  dispute <address>   Inject entropy");
    println!("  approve <address>   Approve crystallization");
    println!("  profile             Show cognitive profile");
    println!("  slo                 Show SLO report");
    println!("  ingest <file>       Ingest a text file");
    println!("  help                Show this help");
}
```

State persistence: save/load to `~/.evolve/memory.json` using `processor().save_to_file()` / `into_processor()` + `load_from_file()`.

### Unit Tests

- `crates/evolve-cli/tests/cli_integration.rs` — **NEW**:
  - `test_add_and_search` — Add content, search for it, verify output
  - `test_profile_output` — Run profile, verify "Memories:" appears
  - `test_ingest_file` — Create temp file, ingest, verify chunk count

---

## Summary

| Phase | Focus | New Files | Tests |
|-------|-------|-----------|-------|
| 1 | Tauri commands (8 new) | 0 | 0 (frontend-tested) |
| 2 | CLI binary | 3 (Cargo.toml, main.rs, test) | 3 |

### Design Principles Applied

1. **No CLI framework**: `std::env::args()` for 10 subcommands. No clap/structopt dependency.
2. **SimpleMemory reuse**: The CLI uses the same `SimpleMemory` API as any Rust consumer. No special internal access.
3. **State as file**: Save/load to JSON. No database, no daemon.

---

_Plan follows Simple Made Easy principles_
