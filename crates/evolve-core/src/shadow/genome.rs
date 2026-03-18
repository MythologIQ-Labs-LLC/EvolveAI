use crate::chain::hash;
use crate::shadow::types::*;
use std::collections::HashMap;

/// Configuration for the shadow genome store.
#[derive(Clone, Debug)]
pub struct ShadowGenomeConfig {
    pub max_entries: usize,
}

impl Default for ShadowGenomeConfig {
    fn default() -> Self {
        Self { max_entries: 1000 }
    }
}

/// Shadow Genome — negative-constraint store tracking failure patterns.
pub struct ShadowGenome {
    entries: HashMap<String, ShadowEntry>,
    config: ShadowGenomeConfig,
}

impl ShadowGenome {
    pub fn new(config: ShadowGenomeConfig) -> Self {
        Self { entries: HashMap::new(), config }
    }

    /// Deterministic ID from trace content.
    fn generate_id(trace: &FailureTrace) -> String {
        let input = format!("{}:{}", trace.intent, trace.message);
        hash::sha256(&input)[..16].to_string()
    }

    /// Ingest a failure trace with its embedding.
    /// Deduplicates by ID — repeated ingestion increments trigger_count.
    /// Returns a clone of the stored entry.
    pub fn ingest(
        &mut self,
        trace: FailureTrace,
        embedding: Vec<f32>,
        now: i64,
    ) -> ShadowEntry {
        let id = Self::generate_id(&trace);

        if let Some(existing) = self.entries.get_mut(&id) {
            existing.trigger_count += 1;
            return existing.clone();
        }

        if self.entries.len() >= self.config.max_entries {
            self.prune_least_valuable();
        }

        let entry = ShadowEntry {
            id: id.clone(),
            embedding,
            category: trace.category,
            trace,
            created_at: now,
            trigger_count: 1,
            active: true,
        };

        self.entries.insert(id.clone(), entry.clone());
        entry
    }

    /// Get all active entries.
    pub fn active_entries(&self) -> Vec<&ShadowEntry> {
        self.entries.values().filter(|e| e.active).collect()
    }

    /// Record a trigger on an existing entry.
    pub fn record_trigger(&mut self, id: &str) {
        if let Some(entry) = self.entries.get_mut(id) {
            entry.trigger_count += 1;
        }
    }

    /// Deactivate an entry (soft delete).
    pub fn deactivate(&mut self, id: &str) -> bool {
        match self.entries.get_mut(id) {
            Some(e) => { e.active = false; true }
            None => false,
        }
    }

    /// Number of entries (active + inactive).
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the genome is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Export all entries for persistence.
    pub fn export_entries(&self) -> Vec<ShadowEntry> {
        self.entries.values().cloned().collect()
    }

    /// Import entries from persistence, replacing current state.
    pub fn import_entries(&mut self, entries: Vec<ShadowEntry>) {
        self.entries.clear();
        for entry in entries {
            self.entries.insert(entry.id.clone(), entry);
        }
    }

    /// Remove the least valuable entry (lowest trigger count, oldest).
    fn prune_least_valuable(&mut self) {
        let target = self.entries.iter()
            .filter(|(_, e)| e.trigger_count <= 1)
            .min_by_key(|(_, e)| e.created_at)
            .map(|(id, _)| id.clone());

        if let Some(id) = target {
            self.entries.remove(&id);
        }
    }
}

impl Default for ShadowGenome {
    fn default() -> Self {
        Self::new(ShadowGenomeConfig::default())
    }
}
