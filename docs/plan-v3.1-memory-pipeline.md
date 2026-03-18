# Plan: v3.1 Memory Pipeline

## Open Questions

1. **Object safety**: The `RepresentationEngine` trait uses RPITIT and is not object-safe. The encoder/decoder need a concrete engine. Should we make the processor generic over `E: RepresentationEngine`, or add an `async_trait` wrapper? **Decision for now**: Generic parameter `E` — avoids new dependencies and is idiomatic for a library crate.

2. **Tier scan strategy**: L1/L2/L3 currently have no "scan all units" method. The decoder needs to iterate units and compare embeddings. Should tiers own the scan, or should the decoder pull units out? **Decision**: Add `iter_units()` to each tier — keeps scan logic local to the tier, decoder only scores.

---

## Phase 1: Query Types & Tier Scanning

### Affected Files

- `crates/evolve-core/src/memory/types.rs` — Add Query, RecallResult, ScoredMemory, RetrievalTrace types
- `crates/evolve-core/src/tiers/l1_cache.rs` — Add `iter_units()` method
- `crates/evolve-core/src/tiers/l2_graph.rs` — Add `iter_units()` method
- `crates/evolve-core/src/tiers/l3_vault.rs` — Add `iter_units()` method

### Changes

**crates/evolve-core/src/memory/types.rs** — append after existing types:

```rust
/// Query for memory retrieval
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Query {
    pub content: String,
    pub constraints: QueryConstraints,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct QueryConstraints {
    pub top_k: Option<usize>,
    pub min_relevance: Option<f32>,
    pub require_tier: Option<Tier>,
    pub exclude_decayed: bool,
}

/// Scored memory from retrieval
#[derive(Clone, Debug)]
pub struct ScoredMemory {
    pub unit: MemoryUnit,
    pub relevance_score: f32,
    pub decayed_weight: f32,
}

/// Retrieval result
#[derive(Clone, Debug)]
pub struct RecallResult {
    pub memories: Vec<ScoredMemory>,
    pub metrics: RecallMetrics,
}

#[derive(Clone, Debug, Default)]
pub struct RecallMetrics {
    pub latency_ms: u64,
    pub tiers_queried: Vec<Tier>,
    pub candidates_evaluated: usize,
    pub decay_filtered: usize,
}
```

**crates/evolve-core/src/tiers/l1_cache.rs** — add method:

```rust
/// Iterate over all non-expired units.
pub fn iter_units(&self, now: i64) -> impl Iterator<Item = &MemoryUnit> {
    self.entries.values()
        .filter(move |e| now - e.inserted_at <= self.ttl_ms)
        .map(|e| &e.unit)
}
```

**crates/evolve-core/src/tiers/l2_graph.rs** — add method:

```rust
/// Iterate over all nodes.
pub fn iter_units(&self) -> impl Iterator<Item = &MemoryUnit> {
    self.nodes.values()
}
```

**crates/evolve-core/src/tiers/l3_vault.rs** — add method:

```rust
/// Iterate over all stored units.
pub fn iter_units(&self) -> impl Iterator<Item = &MemoryUnit> {
    self.entries.values()
}
```

### Unit Tests

- `crates/evolve-core/src/tiers/tests.rs`
  - `test_l1_cache_iter_units_excludes_expired` — Only yields non-expired entries
  - `test_l2_graph_iter_units` — Yields all inserted nodes
  - `test_l3_vault_iter_units` — Yields all stored units

---

## Phase 2: Encoder & Decoder

### Affected Files

- `crates/evolve-core/src/memory/encoder.rs` — NEW: RawInput → MemoryUnit pipeline
- `crates/evolve-core/src/memory/decoder.rs` — NEW: Query → RecallResult pipeline
- `crates/evolve-core/src/memory/mod.rs` — Add `pub mod encoder; pub mod decoder;`

### Changes

**crates/evolve-core/src/memory/encoder.rs**

```rust
use crate::memory::types::*;
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::tiers::router::{route_memory_unit, MtsWeights, TierThresholds};
use crate::chain::hash;
use uuid::Uuid;

/// Encoder configuration
#[derive(Clone, Debug)]
pub struct EncoderConfig {
    pub default_decay_factor: f32,
    pub mts_weights: MtsWeights,
    pub tier_thresholds: TierThresholds,
}

impl Default for EncoderConfig {
    fn default() -> Self {
        Self {
            default_decay_factor: 1.0,
            mts_weights: MtsWeights::default(),
            tier_thresholds: TierThresholds::default(),
        }
    }
}

/// Encode raw input into a routed MemoryUnit.
///
/// Pipeline: embed → hash → route → assemble
pub async fn encode<E: RepresentationEngine>(
    input: &RawInput,
    engine: &E,
    config: &EncoderConfig,
    now: i64,
) -> Result<MemoryUnit, EngineError> {
    // Step 1: Generate embedding
    let rep = engine.encode(&input.content).await?;
    let embedding = rep.as_vector();

    // Step 2: Content-addressed hash
    let content_hash = hash::sha256(&input.content);

    // Step 3: Assemble unit (tier routing happens after)
    let mut unit = MemoryUnit {
        uor_id: Uuid::new_v4(),
        embedding,
        content_hash,
        created_at: now,
        last_accessed: now,
        access_count: 0,
        decay_factor: config.default_decay_factor,
        metadata: UnitMetadata {
            tags: input.metadata.tags.clone(),
            source: input.metadata.source.clone(),
            tier: Tier::L1, // placeholder, set by router
            mts_score: 0.0,
        },
    };

    // Step 4: Route to tier
    let decision = route_memory_unit(&unit, &config.mts_weights, &config.tier_thresholds);
    unit.metadata.tier = decision.tier;
    unit.metadata.mts_score = decision.mts_score;

    Ok(unit)
}
```

**crates/evolve-core/src/memory/decoder.rs**

```rust
use crate::memory::types::*;
use crate::memory::decay::{calculate_decay, should_prune};
use crate::representation::similarity::cosine_similarity;

/// Decoder configuration
#[derive(Clone, Debug)]
pub struct DecoderConfig {
    pub top_k: usize,
    pub decay_threshold: f32,
    pub half_life_ms: i64,
}

impl Default for DecoderConfig {
    fn default() -> Self {
        Self {
            top_k: 10,
            decay_threshold: 0.05,
            half_life_ms: 3_600_000, // 1 hour
        }
    }
}

/// Score a single memory unit against a query embedding.
fn score_unit(unit: &MemoryUnit, query_embedding: &[f32], now: i64, config: &DecoderConfig) -> Option<ScoredMemory> {
    let decayed_weight = calculate_decay(
        unit.last_accessed,
        now,
        config.half_life_ms,
        unit.decay_factor,
    );

    if should_prune(decayed_weight, config.decay_threshold) {
        return None;
    }

    let relevance_score = cosine_similarity(&unit.embedding, query_embedding);

    Some(ScoredMemory {
        unit: unit.clone(),
        relevance_score,
        decayed_weight,
    })
}

/// Decode: score and rank a set of candidate units against query embedding.
///
/// This is the pure scoring function. The caller provides candidates
/// from whichever tiers are relevant.
pub fn decode(
    candidates: &[&MemoryUnit],
    query_embedding: &[f32],
    now: i64,
    config: &DecoderConfig,
) -> Vec<ScoredMemory> {
    let mut scored: Vec<ScoredMemory> = candidates
        .iter()
        .filter_map(|unit| score_unit(unit, query_embedding, now, config))
        .collect();

    // Sort by combined score: relevance × decay weight
    scored.sort_by(|a, b| {
        let score_a = a.relevance_score * a.decayed_weight;
        let score_b = b.relevance_score * b.decayed_weight;
        score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    scored.truncate(config.top_k);
    scored
}
```

### Unit Tests

- `crates/evolve-core/src/memory/tests.rs` (append)
  - `test_encode_produces_valid_unit` — MockEngine encodes, unit has embedding + hash + tier
  - `test_encode_sensitive_routes_to_l3` — Input with "sensitive" tag routes to L3
  - `test_decode_ranks_by_relevance` — Higher similarity ranked first
  - `test_decode_filters_decayed` — Units below threshold excluded
  - `test_decode_respects_top_k` — Returns at most K results
  - `test_decode_empty_candidates` — Returns empty vec

---

## Phase 3: Processor Facade

### Affected Files

- `crates/evolve-core/src/processor/mod.rs` — NEW: Module root
- `crates/evolve-core/src/processor/types.rs` — NEW: Processor result types
- `crates/evolve-core/src/processor/facade.rs` — NEW: MemoryProcessor struct
- `crates/evolve-core/src/lib.rs` — Add `pub mod processor;`

### Changes

**crates/evolve-core/src/processor/types.rs**

```rust
use crate::memory::types::{MemoryUnit, RecallResult, Tier};
use crate::tiers::router::RouteDecision;

/// Result of encoding a memory
#[derive(Clone, Debug)]
pub struct EncodeResult {
    pub unit: MemoryUnit,
    pub decision: RouteDecision,
}

/// Result of querying memory
#[derive(Clone, Debug)]
pub struct QueryResult {
    pub recall: RecallResult,
    pub latency_ms: u64,
}

/// System stats snapshot
#[derive(Clone, Debug)]
pub struct ProcessorStats {
    pub l1_size: usize,
    pub l2_nodes: usize,
    pub l2_edges: usize,
    pub l3_size: usize,
    pub l3_chain_length: usize,
    pub l3_integrity: bool,
}
```

**crates/evolve-core/src/processor/facade.rs**

```rust
use crate::memory::encoder::{self, EncoderConfig};
use crate::memory::decoder::{self, DecoderConfig};
use crate::memory::types::*;
use crate::processor::types::*;
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Configuration for the processor
#[derive(Clone, Debug)]
pub struct ProcessorConfig {
    pub encoder: EncoderConfig,
    pub decoder: DecoderConfig,
    pub l1_ttl_ms: i64,
    pub l1_max_size: usize,
}

impl Default for ProcessorConfig {
    fn default() -> Self {
        Self {
            encoder: EncoderConfig::default(),
            decoder: DecoderConfig::default(),
            l1_ttl_ms: 300_000,  // 5 minutes
            l1_max_size: 1000,
        }
    }
}

/// Central facade for the autopoietic memory system.
///
/// Generic over `E` (the embedding engine) to avoid object-safety issues.
pub struct MemoryProcessor<E: RepresentationEngine> {
    engine: E,
    config: ProcessorConfig,
    l1: L1Cache,
    l2: L2Graph,
    l3: L3Vault,
}

impl<E: RepresentationEngine> MemoryProcessor<E> {
    pub fn new(engine: E, config: ProcessorConfig) -> Self {
        Self {
            l1: L1Cache::new(config.l1_ttl_ms, config.l1_max_size),
            l2: L2Graph::new(),
            l3: L3Vault::new(),
            engine,
            config,
        }
    }

    /// Encode raw input and store in the appropriate tier.
    pub async fn encode(&mut self, input: &RawInput, now: i64) -> Result<EncodeResult, EngineError> {
        let unit = encoder::encode(input, &self.engine, &self.config.encoder, now).await?;
        let decision = crate::tiers::router::route_memory_unit(
            &unit,
            &self.config.encoder.mts_weights,
            &self.config.encoder.tier_thresholds,
        );

        match decision.tier {
            Tier::L1 => self.l1.insert(unit.clone(), now),
            Tier::L2 => self.l2.insert(unit.clone()),
            Tier::L3 => self.l3.store(unit.clone()),
        }

        Ok(EncodeResult { unit, decision })
    }

    /// Query across all tiers and return scored results.
    pub async fn query(&self, query: &Query, now: i64) -> Result<QueryResult, EngineError> {
        let start = std::time::Instant::now();

        // Encode query to get embedding
        let rep = self.engine.encode(&query.content).await?;
        let query_embedding = rep.as_vector();

        // Collect candidates from relevant tiers
        let mut candidates: Vec<&MemoryUnit> = Vec::new();

        match query.constraints.require_tier {
            Some(Tier::L1) => candidates.extend(self.l1.iter_units(now)),
            Some(Tier::L2) => candidates.extend(self.l2.iter_units()),
            Some(Tier::L3) => candidates.extend(self.l3.iter_units()),
            None => {
                candidates.extend(self.l1.iter_units(now));
                candidates.extend(self.l2.iter_units());
                candidates.extend(self.l3.iter_units());
            }
        }

        let tiers_queried = match query.constraints.require_tier {
            Some(t) => vec![t],
            None => vec![Tier::L1, Tier::L2, Tier::L3],
        };

        let total_candidates = candidates.len();

        // Score and rank
        let memories = decoder::decode(
            &candidates,
            &query_embedding,
            now,
            &self.config.decoder,
        );

        let decay_filtered = total_candidates - memories.len();
        let elapsed = start.elapsed().as_millis() as u64;

        Ok(QueryResult {
            recall: RecallResult {
                memories,
                metrics: RecallMetrics {
                    latency_ms: elapsed,
                    tiers_queried,
                    candidates_evaluated: total_candidates,
                    decay_filtered,
                },
            },
            latency_ms: elapsed,
        })
    }

    /// Get system statistics.
    pub fn stats(&self) -> ProcessorStats {
        ProcessorStats {
            l1_size: self.l1.len(),
            l2_nodes: self.l2.node_count(),
            l2_edges: self.l2.edge_count(),
            l3_size: self.l3.len(),
            l3_chain_length: self.l3.ledger().len(),
            l3_integrity: self.l3.verify_integrity(),
        }
    }

    /// Health check — verifies L3 chain integrity.
    pub fn health_check(&self) -> bool {
        self.l3.verify_integrity()
    }
}
```

**crates/evolve-core/src/processor/mod.rs**

```rust
pub mod types;
pub mod facade;

pub use types::*;
pub use facade::*;
```

**crates/evolve-core/src/lib.rs** — add:

```rust
pub mod processor;
```

### Unit Tests

- `crates/evolve-core/src/processor/tests.rs`
  - `test_processor_encode_and_query` — Encode input, query it back, verify found
  - `test_processor_encode_routes_to_correct_tier` — Sensitive → L3, normal → L2
  - `test_processor_query_single_tier` — `require_tier: Some(L1)` only queries L1
  - `test_processor_stats` — Stats reflect inserted units
  - `test_processor_health_check` — Returns true on valid chain
  - `test_processor_query_empty` — Empty system returns empty result

---

## Summary

| Phase | Focus | New Files | Changes |
|-------|-------|-----------|---------|
| 1 | Query types + tier scanning | 0 | 4 modified |
| 2 | Encoder + Decoder | 2 new | 1 modified (mod.rs) |
| 3 | Processor facade | 3 new | 1 modified (lib.rs) |

### Design Principles Applied

1. **Simple over Easy**: Generic `E: RepresentationEngine` avoids runtime dispatch complexity
2. **Values over State**: `encode()` returns `EncodeResult` value, `decode()` is a pure scoring function
3. **Declarative**: `QueryConstraints` declares what, tiers resolve how
4. **Composable**: Encoder and decoder are standalone functions usable without the processor facade
5. **No complecting**: Encoding (embed + route) and decoding (score + rank) are separate pipelines

---

_Plan follows Simple Made Easy principles_
