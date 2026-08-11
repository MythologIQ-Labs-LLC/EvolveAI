use crate::chain::ledger::Ledger;
use crate::processor::types::{PersistError, Snapshot, SNAPSHOT_VERSION};
use crate::shadow::genome::ShadowGenome;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Capture a snapshot of the persistable system state.
pub fn snapshot(l2: &L2Graph, l3: &L3Vault, shadow: &ShadowGenome, now: i64) -> Snapshot {
    Snapshot {
        version: SNAPSHOT_VERSION.to_string(),
        created_at: now,
        l2_nodes: l2.nodes_vec(),
        l2_edges: l2.edges_map().clone(),
        l3_entries: l3.entries_vec(),
        l3_blocks: l3.ledger().blocks().to_vec(),
        shadow_entries: shadow.export_entries(),
    }
}

/// Parse a `major.minor.patch` version string (all-numeric, exactly three
/// components). Returns `None` for anything else. Manual parse — no deps.
fn parse_semver(version: &str) -> Option<(u64, u64, u64)> {
    let mut parts = version.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

/// Semver-style compatibility check: a snapshot is accepted iff its major
/// version matches the current format major. Garbage version strings and
/// major mismatches are rejected with `IncompatibleVersion`.
fn check_version(found: &str) -> Result<(), PersistError> {
    let (expected_major, _, _) =
        parse_semver(SNAPSHOT_VERSION).expect("SNAPSHOT_VERSION is valid semver");
    match parse_semver(found) {
        Some((major, _, _)) if major == expected_major => Ok(()),
        _ => Err(PersistError::IncompatibleVersion {
            expected: SNAPSHOT_VERSION.to_string(),
            found: found.to_string(),
        }),
    }
}

/// Restore from snapshot. Verifies version, chain integrity, and unit
/// content BEFORE adopting any state (no partial restore, no panic on
/// crafted/corrupt snapshots).
pub fn restore(
    l2: &mut L2Graph,
    l3: &mut L3Vault,
    shadow: &mut ShadowGenome,
    snap: Snapshot,
) -> Result<(), PersistError> {
    check_version(&snap.version)?;
    let ledger = Ledger::try_from_blocks(snap.l3_blocks)?;
    let vault = L3Vault::from_parts(snap.l3_entries, ledger);
    match vault.verify_full() {
        Ok(()) => {}
        Err(crate::tiers::l3_vault::IntegrityError::ChainLinkage) => {
            return Err(PersistError::ChainIntegrityFailed);
        }
        Err(e) => return Err(PersistError::UnitIntegrityFailed(e)),
    }
    *l2 = L2Graph::from_parts(snap.l2_nodes, snap.l2_edges);
    *l3 = vault;
    shadow.import_entries(snap.shadow_entries);
    Ok(())
}

/// Save system state to a JSON file (atomic: write-tmp, fsync, rename,
/// then best-effort fsync of the parent directory).
pub fn save_to_file(
    l2: &L2Graph,
    l3: &L3Vault,
    shadow: &ShadowGenome,
    path: &std::path::Path,
    now: i64,
) -> Result<(), PersistError> {
    use std::io::Write;

    let snap = snapshot(l2, l3, shadow, now);
    let json = serde_json::to_string_pretty(&snap)?;
    let tmp = path.with_extension("tmp");
    {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(json.as_bytes())?;
        file.sync_all()?;
    }
    std::fs::rename(&tmp, path)?;
    // Durability of the rename itself: fsync the parent directory.
    // Best-effort — directory fsync is not supported on all platforms.
    if let Some(parent) = path.parent() {
        if let Ok(dir) = std::fs::File::open(parent) {
            let _ = dir.sync_all();
        }
    }
    Ok(())
}

/// Load from JSON file. Verifies integrity and version.
pub fn load_from_file(
    l2: &mut L2Graph,
    l3: &mut L3Vault,
    shadow: &mut ShadowGenome,
    path: &std::path::Path,
) -> Result<(), PersistError> {
    let json = std::fs::read_to_string(path)?;
    let snap: Snapshot = serde_json::from_str(&json)?;
    restore(l2, l3, shadow, snap)
}
