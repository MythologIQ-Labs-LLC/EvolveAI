use crate::memory::types::{MemoryUnit, UorId};
use std::collections::HashMap;

/// L1 Transient Cache -- ephemeral memory with TTL eviction.
pub struct L1Cache {
    entries: HashMap<UorId, CacheEntry>,
    ttl_ms: i64,
    max_size: usize,
}

struct CacheEntry {
    unit: MemoryUnit,
    inserted_at: i64,
}

impl L1Cache {
    /// Create a cache with the given TTL (milliseconds) and maximum capacity.
    pub fn new(ttl_ms: i64, max_size: usize) -> Self {
        Self {
            entries: HashMap::new(),
            ttl_ms,
            max_size,
        }
    }

    /// Insert or update a memory unit at the given timestamp.
    pub fn insert(&mut self, unit: MemoryUnit, now: i64) {
        self.evict_expired(now);
        if self.entries.len() >= self.max_size {
            self.evict_oldest();
        }
        let id = unit.uor_id;
        self.entries.insert(id, CacheEntry { unit, inserted_at: now });
    }

    /// Retrieve a memory unit by ID, returning `None` if expired.
    pub fn get(&self, id: &UorId, now: i64) -> Option<&MemoryUnit> {
        let entry = self.entries.get(id)?;
        if now - entry.inserted_at > self.ttl_ms {
            return None;
        }
        Some(&entry.unit)
    }

    /// Remove all entries whose TTL has elapsed.
    pub fn evict_expired(&mut self, now: i64) {
        self.entries.retain(|_, e| now - e.inserted_at <= self.ttl_ms);
    }

    /// Number of entries (including potentially expired).
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Iterate over all non-expired units.
    pub fn iter_units(&self, now: i64) -> impl Iterator<Item = &MemoryUnit> {
        let ttl = self.ttl_ms;
        self.entries
            .values()
            .filter(move |e| now - e.inserted_at <= ttl)
            .map(|e| &e.unit)
    }

    fn evict_oldest(&mut self) {
        if let Some((&oldest_id, _)) = self
            .entries
            .iter()
            .min_by_key(|(_, e)| e.inserted_at)
        {
            self.entries.remove(&oldest_id);
        }
    }
}
