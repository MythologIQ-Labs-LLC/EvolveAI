# Plan: v5.6 File Ingestion Pipeline (BL-011)

## Open Questions

1. **PDF support**: This plan covers `.txt` and `.md` only. PDF requires an external crate (`pdf-extract` or `lopdf`). Add PDF as a separate feature-flagged phase in a future plan.

2. **Chunk size**: Default 512 characters with paragraph-boundary splitting. Should this be configurable? This plan makes it a parameter on `ChunkConfig`.

3. **Overlap**: Should chunks overlap to preserve context at boundaries? This plan uses zero overlap for simplicity. Overlap adds complexity for marginal recall benefit with content-addressed identity (the same sentence in two chunks produces the same address — deduplication is built in).

---

## Phase 1: Chunking Engine

### Affected Files

- `crates/evolve-core/src/processor/ingest.rs` — **NEW**: chunking + file ingestion
- `crates/evolve-core/src/processor/mod.rs` — Add `ingest` module
- `crates/evolve-core/src/processor/tests.rs` — Chunking tests

### Changes

**processor/ingest.rs** — **NEW** file:

```rust
use crate::memory::types::{
    ContentType, InputMetadata, Priority, RawInput, Sensitivity, UorAddress,
};
use crate::processor::facade::MemoryProcessor;
use crate::representation::engine::{EngineError, RepresentationEngine};

/// Chunking configuration.
#[derive(Clone, Debug)]
pub struct ChunkConfig {
    pub max_chunk_chars: usize,
    pub min_chunk_chars: usize,
}

impl Default for ChunkConfig {
    fn default() -> Self {
        Self { max_chunk_chars: 512, min_chunk_chars: 32 }
    }
}

/// Result of ingesting a file.
#[derive(Clone, Debug)]
pub struct IngestResult {
    pub source: String,
    pub chunks: usize,
    pub addresses: Vec<UorAddress>,
}

/// Split text into chunks at paragraph boundaries, respecting max size.
pub fn chunk_text(text: &str, config: &ChunkConfig) -> Vec<String> {
    let paragraphs: Vec<&str> = text.split("\n\n").collect();
    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();

    for para in paragraphs {
        let trimmed = para.trim();
        if trimmed.is_empty() { continue; }

        if !current.is_empty() && current.len() + trimmed.len() + 2 > config.max_chunk_chars {
            if current.len() >= config.min_chunk_chars {
                chunks.push(current.clone());
            }
            current.clear();
        }

        if !current.is_empty() { current.push_str("\n\n"); }
        current.push_str(trimmed);
    }

    if current.len() >= config.min_chunk_chars {
        chunks.push(current);
    }

    chunks
}

/// Ingest a file's contents into the memory system.
pub async fn ingest_text<E: RepresentationEngine>(
    processor: &mut MemoryProcessor<E>,
    content: &str,
    source: &str,
    tags: Vec<String>,
    config: &ChunkConfig,
    now: i64,
) -> Result<IngestResult, EngineError> {
    let chunks = chunk_text(content, config);
    let mut addresses = Vec::with_capacity(chunks.len());

    for (i, chunk) in chunks.iter().enumerate() {
        let input = RawInput {
            content: chunk.clone(),
            content_type: ContentType::Text,
            metadata: InputMetadata {
                tags: tags.clone(),
                source: Some(format!("{}#chunk-{}", source, i)),
                priority: Priority::Normal,
                sensitivity: Sensitivity::Public,
            },
        };
        let result = processor.encode(&input, now).await?;
        addresses.push(result.unit.address);
    }

    Ok(IngestResult {
        source: source.to_string(),
        chunks: addresses.len(),
        addresses,
    })
}

/// Read a file from disk and ingest it.
pub async fn ingest_file<E: RepresentationEngine>(
    processor: &mut MemoryProcessor<E>,
    path: &std::path::Path,
    tags: Vec<String>,
    config: &ChunkConfig,
    now: i64,
) -> Result<IngestResult, IngestError> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| IngestError::Io(e))?;
    let source = path.display().to_string();
    ingest_text(processor, &content, &source, tags, config, now)
        .await
        .map_err(IngestError::Engine)
}

/// Errors from ingestion.
#[derive(Debug, thiserror::Error)]
pub enum IngestError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("engine error: {0}")]
    Engine(#[from] EngineError),
}
```

**processor/mod.rs** — add `pub mod ingest;`

### Unit Tests

- `processor/tests.rs`
  - `test_chunk_text_splits_at_paragraphs` — "A\n\nB\n\nC" with max=10 → 3 chunks
  - `test_chunk_text_merges_small_paragraphs` — "Hi\n\nBye" with max=100 → 1 chunk (both fit)
  - `test_chunk_text_skips_tiny_chunks` — Single word below min_chunk_chars is skipped
  - `test_chunk_text_empty_input` — "" → 0 chunks
  - `test_chunk_text_respects_max` — Large paragraph gets its own chunk

---

## Phase 2: Processor + SimpleMemory Integration

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Add `ingest_file()` delegation
- `crates/evolve-core/src/simple.rs` — Add `add_file()` convenience
- `crates/evolve-core/src/processor/tests.rs` — Integration tests
- `crates/evolve-core/src/simple.rs` — Inline test

### Changes

**processor/facade.rs** — add method (facade.rs at 243, +5 = 248, under 250):

```rust
pub async fn ingest_file(
    &mut self, path: &std::path::Path, tags: Vec<String>, now: i64,
) -> Result<ingest::IngestResult, ingest::IngestError> {
    ingest::ingest_file(self, path, tags, &ingest::ChunkConfig::default(), now).await
}
```

**simple.rs** — add convenience (+8 = 240, under 250):

```rust
pub async fn add_file(
    &mut self, path: &std::path::Path,
) -> Result<crate::processor::ingest::IngestResult, crate::processor::ingest::IngestError> {
    let now = chrono::Utc::now().timestamp_millis();
    self.processor.ingest_file(path, vec![], now).await
}
```

### Unit Tests

- `processor/tests.rs`
  - `test_ingest_text_creates_memories` — Ingest multi-paragraph text, verify addresses.len() > 1
  - `test_ingest_text_preserves_source` — Check source metadata contains file path + chunk index
  - `test_ingest_file_nonexistent_returns_error` — Bad path → IngestError::Io

- `simple.rs` (inline test)
  - `test_simple_add_file` — Write temp file, add_file, verify profile shows memories

---

## Summary

| Phase | Focus | New Functions | New Tests |
|-------|-------|---------------|-----------|
| 1 | Chunking Engine | `chunk_text`, `ingest_text`, `ingest_file`, `IngestResult`, `IngestError` | 5 |
| 2 | Integration | `facade.ingest_file`, `simple.add_file` | 4 |

### Design Principles Applied

1. **No complecting**: Chunking (pure function) is separate from ingestion (I/O + encoding). `chunk_text` can be tested without a processor.
2. **Values over State**: `ChunkConfig` is a value. `IngestResult` is a value. `chunk_text` is pure.
3. **Composable**: `ingest_text` works on any string — file reading is optional (`ingest_file` = read + `ingest_text`).
4. **Simple over Easy**: No PDF support yet. txt/md only. PDF requires a dependency — plan it separately.

---

_Plan follows Simple Made Easy principles_
