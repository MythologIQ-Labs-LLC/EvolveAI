//! Integration tests driving the built `evolve-cli` binary against
//! temporary state directories (via the `EVOLVE_HOME` override).

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::Duration;

const BIN: &str = env!("CARGO_BIN_EXE_evolve-cli");

/// Fresh, unique state directory for one test.
fn temp_home(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "evolve-cli-test-{}-{}-{}",
        name,
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn run(home: &Path, args: &[&str]) -> Output {
    Command::new(BIN)
        .args(args)
        .env("EVOLVE_HOME", home)
        .output()
        .expect("failed to spawn evolve-cli")
}

fn run_ok(home: &Path, args: &[&str]) -> String {
    let out = run(home, args);
    assert!(
        out.status.success(),
        "command {:?} failed:\nstdout: {}\nstderr: {}",
        args,
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    String::from_utf8_lossy(&out.stdout).into_owned()
}

fn state_json(home: &Path) -> serde_json::Value {
    let text = fs::read_to_string(home.join("memory.json")).expect("memory.json must exist");
    serde_json::from_str(&text).expect("memory.json must be valid JSON")
}

fn is_hex64(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

// ---------------------------------------------------------------------------
// Basic round trip
// ---------------------------------------------------------------------------

#[test]
fn add_search_round_trip() {
    let home = temp_home("roundtrip");
    let addr = run_ok(
        &home,
        &["add", "the", "borrow", "checker", "never", "sleeps"],
    );
    let addr = addr.trim();
    assert!(
        is_hex64(addr),
        "add must print a BLAKE3 address, got: {addr}"
    );

    // State file persisted under EVOLVE_HOME, not the real HOME.
    assert!(home.join("memory.json").exists());
    assert!(home.join("memory.lock").exists());

    let out = run_ok(&home, &["search", "borrow", "checker"]);
    assert!(
        out.contains(addr),
        "search must find the stored address; output was: {out}"
    );
    fs::remove_dir_all(&home).ok();
}

// ---------------------------------------------------------------------------
// Locking
// ---------------------------------------------------------------------------

#[test]
fn lock_contention_blocks_then_completes() {
    let home = temp_home("lockwait");
    // Hold the exclusive lock from the test process.
    let lock_path = home.join("memory.lock");
    let file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(&lock_path)
        .unwrap();
    let mut lock = fd_lock::RwLock::new(file);
    let guard = lock.try_write().expect("test must acquire the lock first");

    let mut child = Command::new(BIN)
        .args(["add", "blocked", "write"])
        .env("EVOLVE_HOME", &home)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();

    // While the lock is held, the child must not complete.
    std::thread::sleep(Duration::from_millis(700));
    assert!(
        child.try_wait().unwrap().is_none(),
        "child must block while the lock is held"
    );

    drop(guard);
    let status = child.wait().unwrap();
    assert!(status.success(), "child must complete once the lock frees");

    let mut stderr = String::new();
    child
        .stderr
        .take()
        .unwrap()
        .read_to_string(&mut stderr)
        .unwrap();
    assert!(
        stderr.contains("waiting for lock"),
        "child must announce it is waiting; stderr was: {stderr}"
    );

    let state = state_json(&home);
    assert_eq!(
        state["l2_nodes"].as_array().unwrap().len(),
        1,
        "the blocked write must land once the lock frees"
    );
    fs::remove_dir_all(&home).ok();
}

#[test]
fn concurrent_adds_lose_no_writes() {
    let home = temp_home("lockrace");
    let contents = ["alpha", "beta", "gamma", "delta", "epsilon"];
    let children: Vec<_> = contents
        .iter()
        .map(|c| {
            Command::new(BIN)
                .args(["add", c])
                .env("EVOLVE_HOME", &home)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .unwrap()
        })
        .collect();
    for mut child in children {
        assert!(child.wait().unwrap().success());
    }
    let state = state_json(&home);
    assert_eq!(
        state["l2_nodes"].as_array().unwrap().len(),
        contents.len(),
        "every concurrent add must survive (no lost writes)"
    );
    fs::remove_dir_all(&home).ok();
}

// ---------------------------------------------------------------------------
// Metabolism commands
// ---------------------------------------------------------------------------

#[test]
fn tick_reports_counts() {
    let home = temp_home("tick");
    run_ok(&home, &["add", "metabolic", "substrate"]);
    let out = run_ok(&home, &["tick"]);
    assert!(out.contains("decay tick:"), "got: {out}");
    assert!(out.contains("L1: examined 0, evicted 0"), "got: {out}");
    assert!(
        out.contains("L2: examined 1, pruned 0, promoted 0"),
        "got: {out}"
    );
    assert!(out.contains("L3: examined 0 (never pruned)"), "got: {out}");
    fs::remove_dir_all(&home).ok();
}

#[test]
fn detach_without_activity_reports_cleanly() {
    let home = temp_home("detach");
    let out = run_ok(&home, &["detach"]);
    assert!(
        out.contains("nothing to detach"),
        "invalid-phase must be handled cleanly; got: {out}"
    );
    fs::remove_dir_all(&home).ok();
}

// ---------------------------------------------------------------------------
// Memory exchange: export
// ---------------------------------------------------------------------------

#[test]
fn export_produces_schema_shaped_envelope() {
    let home = temp_home("export");
    run_ok(&home, &["add", "thermodynamic", "decay"]);
    run_ok(&home, &["add", "hash", "chained", "ledger"]);

    let out_path = home.join("envelope.json");
    run_ok(&home, &["export", "--out", out_path.to_str().unwrap()]);
    let envelope: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&out_path).unwrap()).unwrap();

    // Required top-level blocks.
    assert_eq!(envelope["schema_version"], "1.0.0");
    let exporter = &envelope["exporter"];
    assert_eq!(exporter["implementation"], "evolve-cli");
    assert_eq!(exporter["version"], env!("CARGO_PKG_VERSION"));
    assert!(exporter["exported_at"].is_string());

    let att = &envelope["attestation"];
    assert_eq!(att["content_address_algorithm"], "blake3");
    assert_eq!(att["block_hash_algorithm"], "sha256");
    assert!(att["ledger_head"]["index"].is_u64());
    assert!(is_hex64(att["ledger_head"]["hash"].as_str().unwrap()));
    assert!(is_hex64(att["genesis_hash"].as_str().unwrap()));
    assert!(att["chain_length"].as_u64().unwrap() >= 1);
    assert_eq!(att["chain_verified_at_export"], true);

    // Memory units.
    let memories = envelope["memories"].as_array().unwrap();
    assert_eq!(memories.len(), 2);
    for unit in memories {
        assert!(is_hex64(unit["address"].as_str().unwrap()));
        assert!(
            unit["content"].is_null(),
            "evolve-core retains no raw content"
        );
        assert_eq!(unit["tier"], "L2");
        assert!(["observed", "linked"].contains(&unit["state"].as_str().unwrap()));
        let sigma = unit["saturation"]["sigma"].as_f64().unwrap();
        assert!((0.0..=1.0).contains(&sigma));
        assert_eq!(unit["saturation"]["score_kind"], "lifecycle_routing_score");
        assert_eq!(unit["saturation"]["calibrated"], false);
        assert_eq!(unit["decay"]["model"], "cmhl_thermodynamic");
        assert!(unit["decay"]["half_life_ms"].as_i64().unwrap() >= 1);
        assert_eq!(unit["trust"]["level"], "unverified");
        for field in ["origin", "observer", "method", "timestamp"] {
            assert!(
                unit["provenance"][field].is_string(),
                "missing provenance.{field}"
            );
        }
        assert!(unit["created_at"].is_string());
        assert!(unit["edges"].is_array());
        assert!(
            unit.get("ledger_ref").is_none(),
            "L2 units carry no ledger_ref"
        );
    }
    fs::remove_dir_all(&home).ok();
}

// ---------------------------------------------------------------------------
// Memory exchange: import
// ---------------------------------------------------------------------------

#[test]
fn export_import_round_trip() {
    let source = temp_home("rt-source");
    for content in [
        "one small memory",
        "two small memories",
        "three small memories",
    ] {
        run_ok(&source, &["add", content]);
    }
    let envelope_path = source.join("envelope.json");
    run_ok(
        &source,
        &["export", "--out", envelope_path.to_str().unwrap()],
    );
    let exported: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&envelope_path).unwrap()).unwrap();
    let exported_count = exported["memories"].as_array().unwrap().len();
    assert_eq!(exported_count, 3);

    // Import into a fresh state.
    let target = temp_home("rt-target");
    let out = run_ok(&target, &["import", envelope_path.to_str().unwrap()]);
    assert!(
        out.contains(&format!("imported: {exported_count} proposals")),
        "exported unit count must equal imported proposal count; got: {out}"
    );

    // Doctrine boundary: everything entered L2, nothing crystallized into L3.
    let state = state_json(&target);
    assert_eq!(state["l2_nodes"].as_array().unwrap().len(), exported_count);
    assert_eq!(state["l3_entries"].as_array().unwrap().len(), 0);
    for unit in state["l2_nodes"].as_array().unwrap() {
        assert_eq!(unit["metadata"]["tier"], "L2");
        assert!(unit["metadata"]["tags"]
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t == "imported"));
    }

    // Re-importing the same envelope only skips duplicates.
    let out = run_ok(&target, &["import", envelope_path.to_str().unwrap()]);
    assert!(
        out.contains("imported: 0 proposals") && out.contains("3 duplicates skipped"),
        "got: {out}"
    );

    fs::remove_dir_all(&source).ok();
    fs::remove_dir_all(&target).ok();
}

#[test]
fn import_rejects_envelope_without_attestation() {
    let home = temp_home("noatt");
    let bad = home.join("bad.json");
    fs::write(
        &bad,
        r#"{"schema_version": "1.0.0", "exporter": {"implementation": "x", "version": "0", "exported_at": "2026-08-11T00:00:00Z"}, "memories": []}"#,
    )
    .unwrap();
    let out = run(&home, &["import", bad.to_str().unwrap()]);
    assert!(!out.status.success(), "import must reject the envelope");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("attestation"),
        "rejection must name the missing attestation; stderr: {stderr}"
    );
    assert!(
        !home.join("memory.json").exists(),
        "no state may be written"
    );
    fs::remove_dir_all(&home).ok();
}

#[test]
fn import_rejects_unknown_major_version() {
    let home = temp_home("badver");
    let source = temp_home("badver-src");
    run_ok(&source, &["add", "future", "proof"]);
    let envelope_path = source.join("envelope.json");
    run_ok(
        &source,
        &["export", "--out", envelope_path.to_str().unwrap()],
    );
    let mut envelope: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&envelope_path).unwrap()).unwrap();
    envelope["schema_version"] = serde_json::json!("2.0.0");
    fs::write(&envelope_path, serde_json::to_string(&envelope).unwrap()).unwrap();

    let out = run(&home, &["import", envelope_path.to_str().unwrap()]);
    assert!(!out.status.success());
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("unsupported schema_version"),
        "stderr: {stderr}"
    );
    fs::remove_dir_all(&home).ok();
    fs::remove_dir_all(&source).ok();
}
