use crate::chain::hash;
use crate::chain::ledger::Ledger;
use crate::memory::types::{MemoryUnit, UorAddress};
use std::collections::HashMap;

/// L3 UOR Vault -- immutable memory with cryptographic integrity.
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

    /// Store a memory unit and record its hash on the ledger.
    pub fn store(&mut self, unit: MemoryUnit) {
        let data = serde_json::to_vec(&unit).expect("MemoryUnit serialization cannot fail");
        let data_hash = hash::content_hash(&data);
        self.ledger.append(data_hash);
        self.entries.insert(unit.address.clone(), unit);
    }

    /// O(1) lookup by content address.
    pub fn get_by_address(&self, addr: &UorAddress) -> Option<&MemoryUnit> {
        self.entries.get(addr)
    }

    /// Retrieve a memory unit by address.
    pub fn get(&self, addr: &UorAddress) -> Option<&MemoryUnit> {
        self.entries.get(addr)
    }

    /// Get a mutable reference to an entry by address.
    pub fn get_mut(&mut self, addr: &UorAddress) -> Option<&mut MemoryUnit> {
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

    /// Verify the underlying chain's integrity.
    pub fn verify_integrity(&self) -> bool {
        self.ledger.verify()
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
        let entry_map = entries.into_iter().map(|u| (u.address.clone(), u)).collect();
        Self { entries: entry_map, ledger }
    }
}

impl Default for L3Vault {
    fn default() -> Self {
        Self::new()
    }
}
