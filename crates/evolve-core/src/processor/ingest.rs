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

/// Result of ingesting content.
#[derive(Clone, Debug)]
pub struct IngestResult {
    pub source: String,
    pub chunks: usize,
    pub addresses: Vec<UorAddress>,
}

/// Errors from ingestion.
#[derive(Debug, thiserror::Error)]
pub enum IngestError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("engine error: {0}")]
    Engine(#[from] EngineError),
}

/// Split text into chunks at paragraph boundaries, respecting max size.
pub fn chunk_text(text: &str, config: &ChunkConfig) -> Vec<String> {
    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();

    for para in text.split("\n\n") {
        let trimmed = para.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !current.is_empty() && current.len() + trimmed.len() + 2 > config.max_chunk_chars {
            if current.len() >= config.min_chunk_chars {
                chunks.push(current.clone());
            }
            current.clear();
        }
        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(trimmed);
    }

    if current.len() >= config.min_chunk_chars {
        chunks.push(current);
    }
    chunks
}

/// Ingest text content into the memory system as chunked memories.
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
                ..Default::default()
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

/// Read a file and ingest its contents.
pub async fn ingest_file<E: RepresentationEngine>(
    processor: &mut MemoryProcessor<E>,
    path: &std::path::Path,
    tags: Vec<String>,
    config: &ChunkConfig,
    now: i64,
) -> Result<IngestResult, IngestError> {
    let content = std::fs::read_to_string(path)?;
    let source = path.display().to_string();
    ingest_text(processor, &content, &source, tags, config, now)
        .await
        .map_err(IngestError::Engine)
}
