use crate::memory::types::{
    ContentType, InputMetadata, PinningEvent, Priority,
    Query, QueryConstraints, RawInput, ScoredMemory,
    Sensitivity, TrustLevel, UorAddress,
};
use crate::processor::facade::MemoryProcessor;
use crate::processor::types::ProcessorConfig;
use crate::representation::engine::EngineError;
use crate::representation::mock::MockEngine;

/// Configuration for SimpleMemory.
pub struct SimpleMemoryConfig {
    pub dimensions: usize,
    pub processor: ProcessorConfig,
}

impl Default for SimpleMemoryConfig {
    fn default() -> Self {
        Self {
            dimensions: 384,
            processor: ProcessorConfig::default(),
        }
    }
}

/// Ergonomic 3-method API for the memory system.
///
/// Wraps the full MemoryProcessor with sensible defaults.
/// Power users can call `into_processor()` to access the full API.
pub struct SimpleMemory {
    processor: MemoryProcessor<MockEngine>,
}

impl SimpleMemory {
    pub fn new() -> Self {
        Self::from_config(SimpleMemoryConfig::default())
    }

    pub fn from_config(config: SimpleMemoryConfig) -> Self {
        let engine = MockEngine::new(config.dimensions);
        Self {
            processor: MemoryProcessor::new(engine, config.processor),
        }
    }

    /// Store a memory. Returns its content address.
    pub async fn add(&mut self, content: &str) -> Result<UorAddress, EngineError> {
        let input = RawInput {
            content: content.to_string(),
            content_type: ContentType::Text,
            metadata: InputMetadata::default(),
        };
        let now = chrono::Utc::now().timestamp_millis();
        let result = self.processor.encode(&input, now).await?;
        Ok(result.unit.address)
    }

    /// Store with tags (e.g., vec!["sensitive".into()] for L3 routing).
    pub async fn add_tagged(
        &mut self,
        content: &str,
        tags: Vec<String>,
    ) -> Result<UorAddress, EngineError> {
        let input = RawInput {
            content: content.to_string(),
            content_type: ContentType::Text,
            metadata: InputMetadata {
                tags,
                source: None,
                priority: Priority::Normal,
                sensitivity: Sensitivity::Public,
                ..Default::default()
            },
        };
        let now = chrono::Utc::now().timestamp_millis();
        let result = self.processor.encode(&input, now).await?;
        Ok(result.unit.address)
    }

    /// Search for relevant memories. Returns up to `top_k` results.
    pub async fn search(
        &self,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<ScoredMemory>, EngineError> {
        let q = Query {
            content: query.to_string(),
            constraints: QueryConstraints {
                top_k: Some(top_k),
                ..Default::default()
            },
        };
        let now = chrono::Utc::now().timestamp_millis();
        let result = self.processor.query(&q, now).await?;
        Ok(result.recall.memories)
    }

    /// Provide feedback on a memory (pins fibers, increases saturation).
    pub fn feedback(&mut self, addr: &UorAddress, event: PinningEvent) -> bool {
        self.processor.record_access(addr, event)
    }

    /// Report a conflict (unpins fibers, accelerates decay).
    pub fn dispute(&mut self, addr: &UorAddress, severity: f32) -> Option<f32> {
        self.processor.record_conflict(addr, severity)
    }

    /// Ingest a text file, chunking it into memories automatically.
    pub async fn add_file(
        &mut self,
        path: &std::path::Path,
    ) -> Result<crate::processor::ingest::IngestResult, crate::processor::ingest::IngestError> {
        let now = chrono::Utc::now().timestamp_millis();
        self.processor.ingest_file(path, vec![], now).await
    }

    /// Explicitly approve crystallization (L2->L3) for a saturated unit.
    pub fn approve_crystallization(&mut self, addr: &UorAddress) -> bool {
        self.processor.approve_crystallization(addr)
    }

    /// Store a memory with an explicit trust level.
    pub async fn add_trusted(
        &mut self,
        content: &str,
        trust: TrustLevel,
    ) -> Result<UorAddress, EngineError> {
        let input = RawInput {
            content: content.to_string(),
            content_type: ContentType::Text,
            metadata: InputMetadata {
                trust,
                ..Default::default()
            },
        };
        let now = chrono::Utc::now().timestamp_millis();
        let result = self.processor.encode(&input, now).await?;
        Ok(result.unit.address)
    }

    pub fn end_session(&mut self) {
        self.processor.clear_session();
    }

    pub fn profile(&self) -> crate::processor::profile::CognitiveProfile {
        let now = chrono::Utc::now().timestamp_millis();
        self.processor.profile(now)
    }

    pub fn slo_report(&self) -> crate::processor::slo::SloReport {
        self.processor.slo_report()
    }

    pub fn processor(&self) -> &MemoryProcessor<MockEngine> {
        &self.processor
    }

    pub fn into_processor(self) -> MemoryProcessor<MockEngine> {
        self.processor
    }
}

impl Default for SimpleMemory {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests;
