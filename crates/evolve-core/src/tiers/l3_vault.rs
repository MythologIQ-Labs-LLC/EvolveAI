use crate::chain::hash;
use crate::chain::ledger::Ledger;
use crate::memory::types::{MemoryUnit, UorAddress};
use std::collections::HashMap;

/// Operation kind recorded in the ledger when a unit is stored/crystallized.
const OP_STORE: &str = "store";
/// Operation kind recorded in the ledger when a stored unit is mutated
/// through a legitimate trust update (saturation boost, entropy injection).
const OP_UPDATE: &str = "update";
/// Operation kind recorded when a stored unit is explicitly removed.
const OP_DELETE: &str = "delete";

#[derive(Clone, Debug, PartialEq, Eq)]
enum LedgerState {
    Live(String),
    Deleted(String),
}

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
    /// The ledger says an address is live but the vault no longer contains it.
    #[error("ledger says memory {address} is live but the vault entry is missing")]
    MissingLiveEntry { address: String },
    /// The ledger says an address was deleted but the vault still contains it.
    #[error("ledger says memory {address} was deleted but the vault entry is still present")]
    DeletedEntryPresent { address: String },
    /// Structured history contains an impossible or unsupported transition.
    #[error("invalid ledger transition {operation} for memory {address}")]
    InvalidLedgerTransition { address: String, operation: String },
    /// A stored unit could not be re-serialized for verification.
    #[error("stored unit {address} could not be serialized for verification: {reason}")]
    UnverifiableUnit { address: String, reason: String },
}

/// L3 UOR Vault -- immutable memory with cryptographic integrity.
///
/// Every state transition (store, crystallization, trust update, explicit
/// deletion) appends an entry to the hash-chained ledger, so vault contents
/// can always be reconciled against recorded history via
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

    fn legacy_hash_exists(&self, content_hash: &str) -> bool {
        self.ledger.blocks().iter().any(|block| {
            Self::parse_entry(&block.data_hash).is_none() && block.data_hash == content_hash
        })
    }

    /// Return whether the live unit hash agrees with the newest ledger state
    /// for this address. Legacy bare-hash history remains readable.
    fn ledger_matches_live(&self, addr: &UorAddress, content_hash: &str) -> bool {
        for block in self.ledger.blocks().iter().rev() {
            match Self::parse_entry(&block.data_hash) {
                Some((op, recorded_addr, recorded_hash)) if recorded_addr == addr.as_str() => {
                    return (op == OP_STORE || op == OP_UPDATE) && recorded_hash == content_hash;
                }
                Some(_) => {}
                None if block.data_hash == content_hash => return true,
                None => {}
            }
        }
        false
    }

    /// Replay structured ledger entries into their latest logical state.
    ///
    /// A structured `update` may be the first address-bearing record after a
    /// legacy bare-hash store, so it establishes live state. A first
    /// structured `delete` is accepted only when its prior-state hash exists
    /// in legacy history. Deletes after structured state must match the latest
    /// live hash exactly.
    fn replay_structured_state(&self) -> Result<HashMap<String, LedgerState>, IntegrityError> {
        let mut states = HashMap::new();
        for block in self.ledger.blocks() {
            let Some((op, addr, content_hash)) = Self::parse_entry(&block.data_hash) else {
                continue;
            };
            match op {
                OP_STORE => {
                    states.insert(
                        addr.to_string(),
                        LedgerState::Live(content_hash.to_string()),
                    );
                }
                OP_UPDATE => {
                    if matches!(states.get(addr), Some(LedgerState::Deleted(_))) {
                        return Err(IntegrityError::InvalidLedgerTransition {
                            address: addr.to_string(),
                            operation: op.to_string(),
                        });
                    }
                    states.insert(
                        addr.to_string(),
                        LedgerState::Live(content_hash.to_string()),
                    );
                }
                OP_DELETE => match states.get(addr) {
                    Some(LedgerState::Live(previous_hash)) if previous_hash == content_hash => {
                        states.insert(
                            addr.to_string(),
                            LedgerState::Deleted(content_hash.to_string()),
                        );
                    }
                    Some(LedgerState::Live(_)) | Some(LedgerState::Deleted(_)) => {
                        return Err(IntegrityError::InvalidLedgerTransition {
                            address: addr.to_string(),
                            operation: op.to_string(),
                        });
                    }
                    None if self.legacy_hash_exists(content_hash) => {
                        states.insert(
                            addr.to_string(),
                            LedgerState::Deleted(content_hash.to_string()),
                        );
                    }
                    None => {
                        return Err(IntegrityError::InvalidLedgerTransition {
                            address: addr.to_string(),
                            operation: op.to_string(),
                        });
                    }
                },
                _ => {
                    return Err(IntegrityError::InvalidLedgerTransition {
                        address: addr.to_string(),
                        operation: op.to_string(),
                    });
                }
            }
        }
        Ok(states)
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

    /// Remove a live entry and append an audited deletion record.
    ///
    /// The delete payload keeps only address + last content hash. A missing
    /// address appends nothing. If the live unit no longer agrees with its
    /// ledger history, removal is refused rather than laundering an
    /// unrecorded mutation into a legitimate deletion.
    pub(crate) fn remove(&mut self, addr: &UorAddress) -> Option<MemoryUnit> {
        let content_hash = {
            let unit = self.entries.get(addr)?;
            let content_hash = Self::hash_unit(unit).ok()?;
            if !self.ledger_matches_live(addr, &content_hash) {
                return None;
            }
            content_hash
        };

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

    /// Verify chain linkage AND logical vault state against the ledger.
    /// Boolean convenience wrapper over [`L3Vault::verify_full`].
    pub fn verify_integrity(&self) -> bool {
        self.verify_full().is_ok()
    }

    /// Full integrity verification with typed errors.
    ///
    /// 1. Block linkage / block hashes must be consistent.
    /// 2. Structured store/update/delete history is replayed and validated.
    /// 3. Every stored unit must match the latest recorded live hash (or a
    ///    compatible legacy bare-hash entry).
    /// 4. Every structured address recorded as live must exist in the vault.
    /// 5. Every structured address recorded as deleted must be absent.
    pub fn verify_full(&self) -> Result<(), IntegrityError> {
        if !self.ledger.verify() {
            return Err(IntegrityError::ChainLinkage);
        }

        let states = self.replay_structured_state()?;

        for unit in self.entries.values() {
            let address = unit.address.as_str().to_string();
            let current_hash =
                Self::hash_unit(unit).map_err(|e| IntegrityError::UnverifiableUnit {
                    address: address.clone(),
                    reason: e.to_string(),
                })?;

            match states.get(&address) {
                Some(LedgerState::Live(recorded_hash)) if recorded_hash == &current_hash => {}
                Some(LedgerState::Live(_)) => {
                    return Err(IntegrityError::UnitHashMismatch { address });
                }
                Some(LedgerState::Deleted(_)) => {
                    return Err(IntegrityError::DeletedEntryPresent { address });
                }
                None if self.legacy_hash_exists(&current_hash) => {}
                None => return Err(IntegrityError::MissingLedgerEntry { address }),
            }
        }

        for (address, state) in states {
            let present = self
                .entries
                .keys()
                .any(|candidate| candidate.as_str() == address.as_str());
            match state {
                LedgerState::Live(_) if !present => {
                    return Err(IntegrityError::MissingLiveEntry { address });
                }
                LedgerState::Deleted(_) if present => {
                    return Err(IntegrityError::DeletedEntryPresent { address });
                }
                LedgerState::Live(_) | LedgerState::Deleted(_) => {}
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
