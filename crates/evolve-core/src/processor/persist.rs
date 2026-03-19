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

/// Restore from snapshot. Verifies chain integrity and version.
pub fn restore(
    l2: &mut L2Graph,
    l3: &mut L3Vault,
    shadow: &mut ShadowGenome,
    snap: Snapshot,
) -> Result<(), PersistError> {
    if snap.version != SNAPSHOT_VERSION {
        return Err(PersistError::IncompatibleVersion {
            expected: SNAPSHOT_VERSION.to_string(),
            found: snap.version,
        });
    }
    let ledger = Ledger::from_blocks(snap.l3_blocks);
    if !ledger.verify() {
        return Err(PersistError::ChainIntegrityFailed);
    }
    *l2 = L2Graph::from_parts(snap.l2_nodes, snap.l2_edges);
    *l3 = L3Vault::from_parts(snap.l3_entries, ledger);
    shadow.import_entries(snap.shadow_entries);
    Ok(())
}

/// Save system state to a JSON file (atomic: write-tmp-then-rename).
pub fn save_to_file(
    l2: &L2Graph,
    l3: &L3Vault,
    shadow: &ShadowGenome,
    path: &std::path::Path,
    now: i64,
) -> Result<(), PersistError> {
    let snap = snapshot(l2, l3, shadow, now);
    let json = serde_json::to_string_pretty(&snap)?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, &json)?;
    std::fs::rename(&tmp, path)?;
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
