mod commands;
mod exchange;
mod lock;
mod paths;

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
  tick                       Run one decay tick (evict/prune/promote report)
  detach                     Detach the lifecycle; runs REM synthesis when due
  export [--out <path>]      Export state as a Memory Exchange Envelope v1.0.0
                             (schemas/memory-exchange.schema.json); stdout by
                             default
  import <path> [--mode propose]
                             Import an envelope: units enter L1/L2 as
                             proposals only (never directly L3 -- crystallization
                             goes through the zero-trust approval flow); trust
                             is re-derived locally. The attestation block is
                             required structurally, but foreign chains are NOT
                             cryptographically verified.
  help                       Show this message

State lives in $EVOLVE_HOME (default ~/.evolve): memory.json guarded by an
advisory lock (memory.lock) -- concurrent invocations wait, never lose writes.
Mutating commands run an automatic decay tick before saving.";
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
        "add" => commands::cmd_add(&args[1..]).await,
        "search" => commands::cmd_search(&args[1..]).await,
        "forget" => commands::cmd_forget(&args[1..]),
        "feedback" => commands::cmd_feedback(&args[1..]),
        "dispute" => commands::cmd_dispute(&args[1..]),
        "approve" => commands::cmd_approve(&args[1..]),
        "profile" => commands::cmd_profile(),
        "slo" => commands::cmd_slo(),
        "ingest" => commands::cmd_ingest(&args[1..]).await,
        "tick" => commands::cmd_tick(),
        "detach" => commands::cmd_detach(),
        "export" => commands::cmd_export(&args[1..]),
        "import" => commands::cmd_import(&args[1..]).await,
        other => {
            eprintln!("error: unknown command '{other}'");
            eprintln!("Run 'evolve-cli help' for usage.");
            std::process::exit(1);
        }
    }
}
