use crate::chain::hash;
use crate::chain::ledger::Ledger;
use crate::memory::types::{MemoryUnit, UorAddress};
use std::collections::HashMap;

/// Operation kind recorded in the ledger when a unit is stored/crystallized.
const OP_STORE: &str = "store";
/// Operation kind recorded in the ledger when a stored unit is mutated
/// through a legitimate trust update (saturation boost, entropy injection).
const OP_UPDATE: &str = "update";

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
    /// A stored unit could not be re-serialized for verification.
    #[error("stored unit {address} could not be serialized for verification: {reason}")]
    UnverifiableUnit { address: String, reason: String },
}

/// L3 UOR Vault -- immutable memory with cryptographic integrity.
///
/// Every state transition (store, crystallization, trust update) appends an
/// entry to the hash-chained ledger, so vault contents can always be checked
/// against the recorded history via [`L3Vault::verify_full`].
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

    /// Remove an entry. Returns the unit if found.
    pub(crate) fn remove(&mut self, addr: &UorAddress) -> Option<MemoryUnit> {
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

    /// Verify chain linkage AND unit content against the ledger.
    /// Boolean convenience wrapper over [`L3Vault::verify_full`].
    pub fn verify_integrity(&self) -> bool {
        self.verify_full().is_ok()
    }

    /// Full integrity verification with typed errors.
    ///
    /// 1. Block linkage / block hashes must be consistent.
    /// 2. Every stored unit is re-serialized and its content hash compared
    ///    against the MOST RECENT ledger entry for its address. Legacy
    ///    (pre-5.1) blocks recorded only the bare content hash, so for those
    ///    a unit matches if its current hash equals the block's `data_hash`.
    pub fn verify_full(&self) -> Result<(), IntegrityError> {
        if !self.ledger.verify() {
            return Err(IntegrityError::ChainLinkage);
        }
        for unit in self.entries.values() {
            let address = unit.address.as_str().to_string();
            let current_hash =
                Self::hash_unit(unit).map_err(|e| IntegrityError::UnverifiableUnit {
                    address: address.clone(),
                    reason: e.to_string(),
                })?;

            // Walk newest -> oldest: the first entry for this address is the
            // most recent recorded state.
            let mut verdict = None;
            for block in self.ledger.blocks().iter().rev() {
                match Self::parse_entry(&block.data_hash) {
                    Some((_op, addr, recorded_hash)) => {
                        if addr == unit.address.as_str() {
                            verdict = Some(recorded_hash == current_hash);
                            break;
                        }
                    }
                    None => {
                        // Legacy bare-hash block: can only be matched by
                        // hash equality with the unit's current content.
                        if block.data_hash == current_hash {
                            verdict = Some(true);
                            break;
                        }
                    }
                }
            }
            match verdict {
                Some(true) => {}
                Some(false) => return Err(IntegrityError::UnitHashMismatch { address }),
                None => return Err(IntegrityError::MissingLedgerEntry { address }),
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
