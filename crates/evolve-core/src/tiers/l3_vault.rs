use crate::chain::hash;
use crate::chain::ledger::Ledger;
use crate::memory::types::{MemoryUnit, UorAddress};
use std::collections::{HashMap, HashSet};

/// Operation kind recorded in the ledger when a unit is stored/crystallized.
const OP_STORE: &str = "store";
/// Operation kind recorded in the ledger when a stored unit is mutated
/// through a legitimate trust update (saturation boost, entropy injection).
const OP_UPDATE: &str = "update";
/// Operation kind recorded when a unit is deliberately removed from L3.
///
/// The payload retains only the address and the pre-delete content hash, so
/// the ledger proves which exact stored state was removed without retaining
/// the deleted memory content itself.
const OP_DELETE: &str = "delete";

/// Errors from storing or mutating vault contents.
#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum VaultError {
    /// A non-finite float (NaN/inf) was rejected at the store boundary.
    /// serde_json cannot represent non-finite values, and a non-finite
    /// saturation would corrupt decay math downstream.
    #[error("non-finite {field} value rejected for memory {address}")]
    NonFinite {
        address: String,
        field: &'static str,
    },
    /// Serialization of the unit failed for another reason.
    #[error("serialization failed for memory {address}: {reason}")]
    Serialization { address: String, reason: String },
}

/// Errors from full integrity verification (chain linkage + unit content).
#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum IntegrityError {
    /// Block linkage or block hashes are inconsistent.
    #[error("hash chain linkage verification failed")]
    ChainLinkage,
    /// A stored unit's content hash differs from the most recent ledger
    /// entry recorded for its address (mutation behind the ledger's back).
    #[error("stored unit {address} does not match its most recent ledger entry")]
    UnitHashMismatch { address: String },
    /// A stored unit has no corresponding ledger entry at all.
    #[error("no ledger entry found for stored unit {address}")]
    MissingLedgerEntry { address: String },
    /// The ledger's latest structured operation says a unit should still be
    /// live, but the unit disappeared from the vault without a delete event.
    #[error("ledger expects live unit {address}, but it is missing from the vault")]
    MissingLiveEntry { address: String },
    /// The ledger's latest structured operation is a delete, but the unit is
    /// still present in the live vault.
    #[error("ledger records unit {address} as deleted, but it is still present")]
    DeletedUnitPresent { address: String },
    /// A delete event does not bind the hash of the immediately preceding
    /// recorded live state for that address.
    #[error("delete event for memory {address} does not match its prior recorded live state")]
    InvalidDeleteTransition { address: String },
    /// A structured ledger operation is syntactically valid but unknown to
    /// this implementation. Failing closed avoids silently assigning state
    /// semantics to a future or corrupted operation.
    #[error("unsupported ledger operation {operation} for memory {address}")]
    UnsupportedOperation { address: String, operation: String },
    /// A stored unit could not be re-serialized for verification.
    #[error("stored unit {address} could not be serialized for verification: {reason}")]
    UnverifiableUnit { address: String, reason: String },
}

/// L3 UOR Vault -- immutable memory with cryptographic integrity.
///
/// Every state transition (store, crystallization, trust update, deletion)
/// appends an entry to the hash-chained ledger, so vault contents and deliberate
/// removals can always be checked against recorded history via
/// [`L3Vault::verify_full`].
pub struct L3Vault {
    entries: HashMap<UorAddress, MemoryUnit>,
    ledger: Ledger,
}

impl L3Vault {
    /// Create a new vault with a fresh ledger.
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
            ledger: Ledger::new(),
        }
    }

    /// Reject non-finite floats before they reach serde_json (which cannot
    /// represent them) or decay math (which they would poison).
    /// Mirrors the v5.3 guard in `memory::decay::inject_entropy`.
    fn validate_finite(unit: &MemoryUnit) -> Result<(), VaultError> {
        let field = if !unit.saturation.is_finite() {
            Some("saturation")
        } else if !unit.metadata.mts_score.is_finite() {
            Some("mts_score")
        } else if unit.embedding.iter().any(|v| !v.is_finite()) {
            Some("embedding")
        } else {
            None
        };
        match field {
            Some(field) => Err(VaultError::NonFinite {
                address: unit.address.as_str().to_string(),
                field,
            }),
            None => Ok(()),
        }
    }

    /// Validate and compute the canonical content hash of a unit.
    fn hash_unit(unit: &MemoryUnit) -> Result<String, VaultError> {
        Self::validate_finite(unit)?;
        let data = serde_json::to_vec(unit).map_err(|e| VaultError::Serialization {
            address: unit.address.as_str().to_string(),
            reason: e.to_string(),
        })?;
        Ok(hash::content_hash(&data))
    }

    /// Ledger entry payload: `<op>:<address>:<content-hash>`.
    /// Addresses and hashes are hex digests (no `:`), so parsing is unambiguous.
    fn entry_payload(op: &str, addr: &UorAddress, content_hash: &str) -> String {
        format!("{op}:{addr}:{content_hash}")
    }

    /// Parse a structured ledger entry. Returns `None` for legacy entries
    /// (pre-5.1 blocks recorded only the bare content hash) and genesis.
    fn parse_entry(data_hash: &str) -> Option<(&str, &str, &str)> {
        let mut parts = data_hash.splitn(3, ':');
        let op = parts.next()?;
        let addr = parts.next()?;
        let content_hash = parts.next()?;
        if op.is_empty() || addr.is_empty() || content_hash.is_empty() {
            return None;
        }
        Some((op, addr, content_hash))
    }

    /// Does the current unit hash match the latest recorded live state for
    /// this address? Legacy bare-hash histories are supported as a fallback.
    fn current_state_is_recorded(&self, addr: &UorAddress, current_hash: &str) -> bool {
        for block in self.ledger.blocks().iter().rev() {
            if let Some((op, recorded_addr, recorded_hash)) = Self::parse_entry(&block.data_hash) {
                if recorded_addr != addr.as_str() {
                    continue;
                }
                return matches!(op, OP_STORE | OP_UPDATE) && recorded_hash == current_hash;
            }
            if block.data_hash == current_hash {
                return true;
            }
        }
        false
    }

    /// Store a memory unit and record its hash on the ledger.
    /// pub(crate): only internal code can bypass the crystallization policy.
    ///
    /// Rejects units containing non-finite floats with a typed error;
    /// vault and ledger are untouched on failure.
    pub(crate) fn store(&mut self, unit: MemoryUnit) -> Result<(), VaultError> {
        let content_hash = Self::hash_unit(&unit)?;
        self.ledger
            .append(Self::entry_payload(OP_STORE, &unit.address, &content_hash));
        self.entries.insert(unit.address.clone(), unit);
        Ok(())
    }

    /// Mutate a stored unit and atomically append a ledger entry recording
    /// the post-mutation content hash. This is the ONLY legitimate mutation
    /// path: safe callers cannot desynchronize vault and ledger.
    ///
    /// Returns `None` if the address is not stored. If the mutated unit fails
    /// validation (e.g. non-finite saturation), the mutation is rolled back
    /// and `Some(Err(_))` is returned; vault and ledger stay consistent.
    pub(crate) fn update_with<R>(
        &mut self,
        addr: &UorAddress,
        mutate: impl FnOnce(&mut MemoryUnit) -> R,
    ) -> Option<Result<R, VaultError>> {
        let unit = self.entries.get_mut(addr)?;
        let backup = unit.clone();
        let out = mutate(unit);
        match Self::hash_unit(unit) {
            Ok(content_hash) => {
                self.ledger
                    .append(Self::entry_payload(OP_UPDATE, addr, &content_hash));
                Some(Ok(out))
            }
            Err(e) => {
                self.entries.insert(addr.clone(), backup);
                Some(Err(e))
            }
        }
    }

    /// O(1) lookup by content address.
    pub fn get_by_address(&self, addr: &UorAddress) -> Option<&MemoryUnit> {
        self.entries.get(addr)
    }

    /// Retrieve a memory unit by address.
    pub fn get(&self, addr: &UorAddress) -> Option<&MemoryUnit> {
        self.entries.get(addr)
    }

    /// Remove an entry and record an explicit deletion in the hash chain.
    ///
    /// The deletion entry binds the address and exact pre-delete content hash.
    /// The current content must already match the latest recorded live state,
    /// preventing an unrecorded mutation from being laundered by a later
    /// delete. Validation/serialization or ledger-state mismatch fails closed
    /// and leaves both vault and ledger unchanged.
    pub(crate) fn remove(&mut self, addr: &UorAddress) -> Option<MemoryUnit> {
        let unit = self.entries.get(addr)?;
        let content_hash = Self::hash_unit(unit).ok()?;
        if !self.current_state_is_recorded(addr, &content_hash) {
            return None;
        }
        self.ledger
            .append(Self::entry_payload(OP_DELETE, addr, &content_hash));
        self.entries.remove(addr)
    }

    /// Raw mutable access, bypassing the ledger. Test-only: any mutation
    /// through this handle desynchronizes vault and ledger and is caught by
    /// [`L3Vault::verify_full`]. Use [`L3Vault::update_with`] instead.
    #[cfg(test)]
    pub(crate) fn get_mut(&mut self, addr: &UorAddress) -> Option<&mut MemoryUnit> {
        self.entries.get_mut(addr)
    }

    /// Raw removal that deliberately bypasses the ledger. Test-only: used to
    /// prove that an unrecorded disappearance is not equivalent to a legitimate
    /// audited delete.
    #[cfg(test)]
    pub(crate) fn remove_unrecorded_for_test(&mut self, addr: &UorAddress) -> Option<MemoryUnit> {
        self.entries.remove(addr)
    }

    /// Iterate over all stored units.
    pub fn iter_units(&self) -> impl Iterator<Item = &MemoryUnit> {
        self.entries.values()
    }

    /// Number of stored memories.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the vault is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Verify chain linkage AND live/deleted unit state against the ledger.
    /// Boolean convenience wrapper over [`L3Vault::verify_full`].
    pub fn verify_integrity(&self) -> bool {
        self.verify_full().is_ok()
    }

    /// Full integrity verification with typed errors.
    ///
    /// 1. Block linkage / block hashes must be consistent.
    /// 2. Each delete must bind the immediately preceding recorded live-state
    ///    hash for the same address (or a legacy bare hash).
    /// 3. For structured ledger history, the latest operation for every
    ///    address determines whether the unit must be live (`store`/`update`)
    ///    or absent (`delete`).
    /// 4. A live unit's canonical hash must equal the latest recorded hash.
    /// 5. Legacy bare-hash blocks remain supported for live units created by
    ///    pre-5.1 snapshots where the address was not recorded structurally.
    pub fn verify_full(&self) -> Result<(), IntegrityError> {
        if !self.ledger.verify() {
            return Err(IntegrityError::ChainLinkage);
        }

        let mut latest: HashMap<String, (String, String)> = HashMap::new();
        let mut legacy_hashes: HashSet<String> = HashSet::new();
        for block in self.ledger.blocks() {
            if let Some((op, addr, recorded_hash)) = Self::parse_entry(&block.data_hash) {
                match op {
                    OP_STORE => {}
                    OP_UPDATE => {}
                    OP_DELETE => {
                        let prior_structured_matches =
                            latest.get(addr).is_some_and(|(prior_op, prior_hash)| {
                                matches!(prior_op.as_str(), OP_STORE | OP_UPDATE)
                                    && prior_hash == recorded_hash
                            });
                        let prior_legacy_matches = legacy_hashes.contains(recorded_hash);
                        if !prior_structured_matches && !prior_legacy_matches {
                            return Err(IntegrityError::InvalidDeleteTransition {
                                address: addr.to_string(),
                            });
                        }
                    }
                    _ => {
                        return Err(IntegrityError::UnsupportedOperation {
                            address: addr.to_string(),
                            operation: op.to_string(),
                        });
                    }
                }
                latest.insert(
                    addr.to_string(),
                    (op.to_string(), recorded_hash.to_string()),
                );
            } else {
                legacy_hashes.insert(block.data_hash.clone());
            }
        }

        for (address, (operation, recorded_hash)) in &latest {
            let live_unit = self
                .entries
                .values()
                .find(|unit| unit.address.as_str() == address);
            match operation.as_str() {
                OP_STORE | OP_UPDATE => {
                    let unit = live_unit.ok_or_else(|| IntegrityError::MissingLiveEntry {
                        address: address.clone(),
                    })?;
                    let current_hash =
                        Self::hash_unit(unit).map_err(|e| IntegrityError::UnverifiableUnit {
                            address: address.clone(),
                            reason: e.to_string(),
                        })?;
                    if &current_hash != recorded_hash {
                        return Err(IntegrityError::UnitHashMismatch {
                            address: address.clone(),
                        });
                    }
                }
                OP_DELETE => {
                    if live_unit.is_some() {
                        return Err(IntegrityError::DeletedUnitPresent {
                            address: address.clone(),
                        });
                    }
                }
                _ => unreachable!("structured operations were validated above"),
            }
        }

        // Legacy live units may have only a bare content hash rather than a
        // structured address-bearing operation. Preserve that compatibility.
        for unit in self.entries.values() {
            let address = unit.address.as_str().to_string();
            if latest.contains_key(&address) {
                continue;
            }
            let current_hash =
                Self::hash_unit(unit).map_err(|e| IntegrityError::UnverifiableUnit {
                    address: address.clone(),
                    reason: e.to_string(),
                })?;
            if !legacy_hashes.contains(&current_hash) {
                return Err(IntegrityError::MissingLedgerEntry { address });
            }
        }

        Ok(())
    }

    /// Borrow the ledger for inspection.
    pub fn ledger(&self) -> &Ledger {
        &self.ledger
    }

    /// Get all entries as a vec (for snapshotting).
    pub fn entries_vec(&self) -> Vec<MemoryUnit> {
        self.entries.values().cloned().collect()
    }

    /// Reconstruct from parts (entries + ledger).
    pub fn from_parts(entries: Vec<MemoryUnit>, ledger: Ledger) -> Self {
        let entry_map = entries
            .into_iter()
            .map(|u| (u.address.clone(), u))
            .collect();
        Self {
            entries: entry_map,
            ledger,
        }
    }
}

impl Default for L3Vault {
    fn default() -> Self {
        Self::new()
    }
}
