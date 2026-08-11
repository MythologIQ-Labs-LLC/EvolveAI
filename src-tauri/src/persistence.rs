//! Automatic persistence for the desktop app.
//!
//! # Default state location
//!
//! `~/.evolve/desktop.json` — the same `.evolve` directory the CLI uses
//! (the CLI writes `~/.evolve/memory.json`, see `crates/evolve-cli/src/main.rs`),
//! with a distinct filename so desktop and CLI state never clobber each other.
//!
//! Home resolution uses the `dirs` crate (already in the dependency tree via
//! tauri itself), falling back to `$HOME`, then `%USERPROFILE%`, then `.` —
//! mirroring the CLI's HOME-unset fallback chain.
//!
//! # Lifecycle
//!
//! - **Startup** (`load_default`, called from `main.rs` setup): if the default
//!   state file exists it is loaded into the managed processor. On failure
//!   (corrupt / incompatible snapshot) the bad file is renamed to
//!   `desktop.json.corrupt-<unix-ts>` so the user's data is preserved for
//!   recovery, and the app starts fresh.
//! - **After mutations**: mutating commands call [`mark_dirty`]; a debounced
//!   background task (spawned by [`spawn_autosave`]) coalesces bursts and
//!   saves at most once per debounce window. The `Notify` permit semantics
//!   guarantee the final state of a burst is always persisted: a signal that
//!   arrives during a save leaves a stored permit, triggering one more save.
//! - **Periodically** ([`spawn_metabolism`]): a background decay tick runs
//!   every ten minutes; it signals the autosave only when the tick actually
//!   evicted, pruned, or promoted something.
//! - **Exit** (via the `RunEvent` hook in `main.rs`): a `detach()` attempt
//!   (REM-synthesis consolidation; a no-op for an idle app) followed by a
//!   final synchronous `save_default`.
//!
//! Saves go through `MemoryProcessor::save_to_file`, which writes atomically
//! (tmp-then-rename), so a crash mid-save cannot corrupt the previous file.

use crate::state::AppProcessor;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use tauri::Manager;
use tokio::sync::{Mutex, Notify};

/// Debounce window for autosave: bursts of mutations within this window
/// collapse into (at most) two saves, the last of which sees the final state.
const DEBOUNCE_MS: u64 = 750;

/// Interval between background metabolism ticks (decay / prune / promote).
const METABOLISM_INTERVAL_SECS: u64 = 600;

/// Directory holding persistent state: `~/.evolve` (shared with the CLI).
pub fn state_dir() -> PathBuf {
    let base = dirs::home_dir()
        .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."));
    base.join(".evolve")
}

/// Default state file for the desktop app: `~/.evolve/desktop.json`.
pub fn state_file() -> PathBuf {
    state_dir().join("desktop.json")
}

/// Dirty signal shared between commands and the autosave task.
///
/// A global (rather than managed Tauri state) so that mutating commands can
/// signal without any change to their signatures.
static DIRTY: OnceLock<Arc<Notify>> = OnceLock::new();

fn dirty_notify() -> Arc<Notify> {
    DIRTY.get_or_init(|| Arc::new(Notify::new())).clone()
}

/// Signal that in-memory state changed. The autosave task (if running)
/// persists to the default path after a short debounce. Cheap and non-blocking;
/// safe to call from any thread. A no-op burst-coalescing permit is stored if
/// the task is mid-save.
pub fn mark_dirty() {
    dirty_notify().notify_one();
}

/// Save the processor to the default state file, creating `~/.evolve` if
/// needed. Errors are logged, never fatal.
pub async fn save_default(processor: &Mutex<AppProcessor>) {
    let dir = state_dir();
    if let Err(e) = std::fs::create_dir_all(&dir) {
        eprintln!("[persist] cannot create {}: {e}", dir.display());
        return;
    }
    let path = state_file();
    let now = chrono::Utc::now().timestamp_millis();
    let proc = processor.lock().await;
    if let Err(e) = proc.save_to_file(&path, now) {
        eprintln!("[persist] save to {} failed: {e}", path.display());
    }
}

/// Load the default state file into the processor, if it exists.
///
/// On load failure (corrupt JSON, failed chain integrity, incompatible
/// snapshot version) the bad file is renamed to `<name>.corrupt-<unix-ts>` —
/// never overwritten — and the app continues with a fresh processor.
pub async fn load_default(processor: &Mutex<AppProcessor>) {
    let path = state_file();
    if !path.exists() {
        return;
    }
    let mut proc = processor.lock().await;
    match proc.load_from_file(&path) {
        Ok(()) => {
            eprintln!("[persist] loaded state from {}", path.display());
        }
        Err(e) => {
            drop(proc);
            eprintln!(
                "[persist] failed to load {}: {e}; starting fresh",
                path.display()
            );
            let ts = chrono::Utc::now().timestamp();
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("desktop.json");
            let backup = path.with_file_name(format!("{name}.corrupt-{ts}"));
            match std::fs::rename(&path, &backup) {
                Ok(()) => eprintln!(
                    "[persist] preserved unreadable state at {}",
                    backup.display()
                ),
                Err(re) => eprintln!("[persist] could not preserve {}: {re}", path.display()),
            }
        }
    }
}

/// Spawn the debounced autosave task on Tauri's async runtime.
///
/// The task waits for a [`mark_dirty`] signal, sleeps the debounce window to
/// coalesce bursts, then saves. Signals arriving during the sleep or the save
/// leave a stored `Notify` permit, so the loop immediately runs once more —
/// the final state after any burst is always persisted, with no lost updates
/// and no busy polling.
pub fn spawn_autosave(app: tauri::AppHandle) {
    let notify = dirty_notify();
    tauri::async_runtime::spawn(async move {
        loop {
            notify.notified().await;
            tokio::time::sleep(std::time::Duration::from_millis(DEBOUNCE_MS)).await;
            let processor = app.state::<Mutex<AppProcessor>>();
            save_default(&processor).await;
        }
    });
}

/// Spawn the periodic metabolism task on Tauri's async runtime.
///
/// Every [`METABOLISM_INTERVAL_SECS`] the task runs one decay tick over the
/// tiers (L1 TTL eviction, L2 CMHL pruning, Auto-policy promotion). The
/// autosave is signaled only when the report shows something actually
/// changed — a no-op tick must not churn the state file.
pub fn spawn_metabolism(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval =
            tokio::time::interval(std::time::Duration::from_secs(METABOLISM_INTERVAL_SECS));
        // The first tick of a tokio interval fires immediately; skip it so
        // startup (right after load) is not followed by a pointless tick.
        interval.tick().await;
        loop {
            interval.tick().await;
            let processor = app.state::<Mutex<AppProcessor>>();
            let now = chrono::Utc::now().timestamp_millis();
            let report = processor.lock().await.run_decay_tick(now);
            if report.l1_evicted + report.l2_pruned + report.l2_promoted > 0 {
                mark_dirty();
            }
        }
    });
}
