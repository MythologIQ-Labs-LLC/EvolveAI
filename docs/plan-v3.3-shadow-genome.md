# Plan: v3.3 Shadow Genome

## Open Questions

1. **Embedding dependency**: The genome stores embeddings for similarity matching. Should it depend on `RepresentationEngine`? **Decision**: No — the genome accepts `Vec<f32>` embeddings. The caller (processor or bootstrap) is responsible for embedding generation. This keeps the shadow module independent.

2. **Persistence**: Should the genome be included in the processor's `Snapshot`? **Decision**: Yes — add `shadow_entries` to the existing `Snapshot` struct. This reuses the v3.2 persistence infrastructure.

---

## Phase 1: Shadow Types & Genome Store

### Affected Files

- `crates/evolve-core/src/shadow/mod.rs` — NEW: Module root
- `crates/evolve-core/src/shadow/types.rs` — NEW: FailureCategory, FailureTrace, ShadowEntry
- `crates/evolve-core/src/shadow/genome.rs` — NEW: ShadowGenome store
- `crates/evolve-core/src/lib.rs` — Add `pub mod shadow;`

### Changes

**crates/evolve-core/src/shadow/types.rs**

```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum FailureCategory {
    ComplexityViolation,
    PrematureOptimization,
    Hallucination,
    SecurityRegression,
    ScopeCreep,
    TechnicalDebt,
    ResourceExhaustion,
    IntegrationFailure,
    TestFailure,
    ValidationError,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

impl FailureCategory {
    pub fn default_severity(&self) -> Severity {
        match self {
            Self::SecurityRegression => Severity::Critical,
            Self::Hallucination | Self::IntegrationFailure | Self::TestFailure => Severity::High,
            Self::ComplexityViolation | Self::ScopeCreep
            | Self::ResourceExhaustion | Self::ValidationError => Severity::Medium,
            Self::PrematureOptimization | Self::TechnicalDebt => Severity::Low,
        }
    }
}

/// Record of a failure occurrence.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FailureTrace {
    pub category: FailureCategory,
    pub severity: Severity,
    pub intent: String,
    pub message: String,
    pub timestamp: i64,
}

/// Stored failure pattern with embedding for similarity matching.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ShadowEntry {
    pub id: String,
    pub embedding: Vec<f32>,
    pub category: FailureCategory,
    pub trace: FailureTrace,
    pub created_at: i64,
    pub trigger_count: u32,
    pub active: bool,
}
```

**crates/evolve-core/src/shadow/genome.rs**

```rust
use crate::chain::hash;
use crate::shadow::types::*;
use std::collections::HashMap;

pub struct ShadowGenomeConfig {
    pub max_entries: usize,
}

impl Default for ShadowGenomeConfig {
    fn default() -> Self {
        Self { max_entries: 1000 }
    }
}

pub struct ShadowGenome {
    entries: HashMap<String, ShadowEntry>,
    config: ShadowGenomeConfig,
}

impl ShadowGenome {
    pub fn new(config: ShadowGenomeConfig) -> Self {
        Self { entries: HashMap::new(), config }
    }

    /// Generate deterministic ID from trace content.
    fn generate_id(trace: &FailureTrace) -> String {
        let input = format!("{}:{}", trace.intent, trace.message);
        hash::sha256(&input)[..16].to_string()
    }

    /// Ingest a failure trace with its embedding.
    pub fn ingest(&mut self, trace: FailureTrace, embedding: Vec<f32>, now: i64) -> &ShadowEntry {
        let id = Self::generate_id(&trace);

        if let Some(existing) = self.entries.get_mut(&id) {
            existing.trigger_count += 1;
            return existing;
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

        self.entries.insert(id.clone(), entry);
        self.entries.get(&id).unwrap()
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

    pub fn len(&self) -> usize { self.entries.len() }
    pub fn is_empty(&self) -> bool { self.entries.is_empty() }

    /// Export all entries (for persistence).
    pub fn export_entries(&self) -> Vec<ShadowEntry> {
        self.entries.values().cloned().collect()
    }

    /// Import entries (from persistence).
    pub fn import_entries(&mut self, entries: Vec<ShadowEntry>) {
        self.entries.clear();
        for entry in entries {
            self.entries.insert(entry.id.clone(), entry);
        }
    }

    fn prune_least_valuable(&mut self) {
        if let Some(id) = self.entries.iter()
            .filter(|(_, e)| e.trigger_count <= 1)
            .min_by_key(|(_, e)| e.created_at)
            .map(|(id, _)| id.clone())
        {
            self.entries.remove(&id);
        }
    }
}

impl Default for ShadowGenome {
    fn default() -> Self {
        Self::new(ShadowGenomeConfig::default())
    }
}
```

### Unit Tests

- `crates/evolve-core/src/shadow/tests.rs`
  - `test_ingest_creates_entry` — Ingest trace, verify entry exists
  - `test_ingest_deduplicates` — Same trace twice increments trigger_count
  - `test_active_entries_excludes_inactive` — Deactivated entries filtered
  - `test_record_trigger_increments` — Trigger count increases
  - `test_export_import_roundtrip` — Export entries, import into new genome, verify

---

## Phase 2: Interceptor

### Affected Files

- `crates/evolve-core/src/shadow/interceptor.rs` — NEW: Intent safety checker
- `crates/evolve-core/src/shadow/mod.rs` — Add `pub mod interceptor;`

### Changes

**crates/evolve-core/src/shadow/interceptor.rs**

```rust
use crate::representation::similarity::cosine_similarity;
use crate::shadow::genome::ShadowGenome;
use crate::shadow::types::*;

#[derive(Clone, Debug)]
pub struct InterceptorConfig {
    pub safety_threshold: f32,
    pub critical_categories: Vec<FailureCategory>,
}

impl Default for InterceptorConfig {
    fn default() -> Self {
        Self {
            safety_threshold: 0.85,
            critical_categories: vec![
                FailureCategory::SecurityRegression,
                FailureCategory::Hallucination,
            ],
        }
    }
}

#[derive(Clone, Debug)]
pub enum Verdict {
    Pass,
    Block { matched: Vec<String>, reasoning: String },
}

/// Check an intent embedding against the shadow genome.
pub fn check_intent(
    intent_embedding: &[f32],
    genome: &mut ShadowGenome,
    config: &InterceptorConfig,
) -> Verdict {
    let entries = genome.active_entries();
    let mut matches: Vec<(String, f32, FailureCategory)> = Vec::new();

    for entry in &entries {
        let sim = cosine_similarity(intent_embedding, &entry.embedding);

        let threshold = if config.critical_categories.contains(&entry.category) {
            config.safety_threshold * 0.7
        } else {
            config.safety_threshold
        };

        if sim >= threshold {
            matches.push((entry.id.clone(), sim, entry.category));
            genome.record_trigger(&entry.id);
        }
    }

    if matches.is_empty() {
        return Verdict::Pass;
    }

    matches.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let categories: Vec<String> = matches.iter()
        .map(|(_, _, c)| format!("{:?}", c))
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    Verdict::Block {
        matched: matches.iter().map(|(id, _, _)| id.clone()).collect(),
        reasoning: format!("Blocked: matches {} patterns", categories.join(", ")),
    }
}
```

### Unit Tests

- `crates/evolve-core/src/shadow/tests.rs` (append)
  - `test_check_passes_no_match` — Unrelated embedding passes
  - `test_check_blocks_similar_intent` — Similar embedding triggers block
  - `test_check_critical_has_lower_threshold` — Critical categories block at 0.7× threshold
  - `test_check_records_triggers` — Trigger count incremented on match

---

## Phase 3: Integration with Processor

### Affected Files

- `crates/evolve-core/src/processor/types.rs` — Add `shadow_entries` to `Snapshot`
- `crates/evolve-core/src/processor/facade.rs` — Add shadow genome to processor, wire into snapshot/restore

### Changes

**crates/evolve-core/src/processor/types.rs** — extend Snapshot:

```rust
use crate::shadow::types::ShadowEntry;

// Add to existing Snapshot struct:
pub shadow_entries: Vec<ShadowEntry>,
```

**crates/evolve-core/src/processor/facade.rs** — add shadow genome:

```rust
use crate::shadow::genome::ShadowGenome;
use crate::shadow::interceptor::{self, InterceptorConfig, Verdict};
use crate::shadow::types::FailureTrace;

// Add to MemoryProcessor struct:
shadow: ShadowGenome,

// Add to ProcessorConfig:
pub interceptor: InterceptorConfig,

// New methods on MemoryProcessor:

/// Check intent safety against shadow genome.
pub async fn check_safety(&mut self, intent: &str, now: i64) -> Result<Verdict, EngineError> {
    let rep = self.engine.encode(intent).await?;
    let embedding = rep.as_vector();
    Ok(interceptor::check_intent(&embedding, &mut self.shadow, &self.config.interceptor))
}

/// Ingest a failure trace into the shadow genome.
pub async fn record_failure(
    &mut self,
    trace: FailureTrace,
    now: i64,
) -> Result<(), EngineError> {
    let rep = self.engine.encode(&trace.intent).await?;
    self.shadow.ingest(trace, rep.as_vector(), now);
    Ok(())
}

// Update snapshot() to include shadow:
pub shadow_entries: self.shadow.export_entries(),

// Update restore() to include shadow:
self.shadow.import_entries(snapshot.shadow_entries);
```

### Unit Tests

- `crates/evolve-core/src/processor/tests.rs` (append)
  - `test_processor_check_safety_passes` — Unknown intent passes
  - `test_processor_record_and_block_failure` — Record failure, check similar intent, verify block
  - `test_snapshot_includes_shadow` — Shadow entries in snapshot after recording failure

---

## Summary

| Phase | Focus | New Files | Changes |
|-------|-------|-----------|---------|
| 1 | Shadow types + genome store | 4 new | 1 modified (lib.rs) |
| 2 | Interceptor | 1 new | 1 modified (mod.rs) |
| 3 | Processor integration | 0 | 2 modified |

### Design Principles Applied

1. **Simple over Easy**: Genome is a plain HashMap — no complex data structures
2. **Values over State**: `FailureTrace` and `ShadowEntry` are serializable values
3. **Composable**: Shadow module is standalone — usable without the processor
4. **Declarative**: `FailureCategory` enum with `default_severity()` — data, not logic
5. **No complecting**: Types, storage, and interception are separate files

---

_Plan follows Simple Made Easy principles_
