use crate::memory::types::{
    ContentType, InputMetadata, PinningEvent, Priority,
    Query, QueryConstraints, RawInput, ScoredMemory,
    Sensitivity, UorAddress,
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

    /// End the current session (clears co-capture linking state).
    pub fn end_session(&mut self) {
        self.processor.clear_session();
    }

    /// Access the full processor for power-user operations.
    pub fn processor(&self) -> &MemoryProcessor<MockEngine> {
        &self.processor
    }

    /// Consume into the full processor.
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
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_add_and_search() {
        let mut mem = SimpleMemory::new();
        mem.add("the sky is blue").await.unwrap();
        let results = mem.search("the sky is blue", 5).await.unwrap();
        assert_eq!(results.len(), 1);
    }

    #[tokio::test]
    async fn test_add_returns_deterministic_address() {
        let mut mem = SimpleMemory::new();
        let a1 = mem.add("same content").await.unwrap();
        let a2 = UorAddress::from_content("same content");
        assert_eq!(a1, a2);
    }

    #[tokio::test]
    async fn test_feedback_boosts_saturation() {
        let mut mem = SimpleMemory::new();
        let addr = mem.add("important fact").await.unwrap();
        assert!(mem.feedback(&addr, PinningEvent::CryptoVerification));
    }

    #[tokio::test]
    async fn test_dispute_reduces_saturation() {
        let mut mem = SimpleMemory::new();
        let addr = mem.add("disputed claim").await.unwrap();
        mem.feedback(&addr, PinningEvent::CryptoVerification);
        assert!(mem.dispute(&addr, 0.1).is_some());
    }

    #[tokio::test]
    async fn test_end_session_clears_linking() {
        let mut mem = SimpleMemory::new();
        mem.add("fact one").await.unwrap();
        mem.end_session();
        mem.add("fact two").await.unwrap();
        assert_eq!(mem.processor().stats().l2_edges, 0);
    }

    #[tokio::test]
    async fn test_into_processor_gives_full_access() {
        let mem = SimpleMemory::new();
        let proc = mem.into_processor();
        assert!(proc.health_check());
    }

    #[tokio::test]
    async fn test_add_tagged_routes_sensitive_to_l3() {
        let mut mem = SimpleMemory::new();
        mem.add_tagged("secret", vec!["sensitive".into()]).await.unwrap();
        assert!(mem.processor().stats().l3_size > 0);
    }

    #[tokio::test]
    async fn test_search_empty_returns_empty() {
        let mem = SimpleMemory::new();
        let results = mem.search("anything", 10).await.unwrap();
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_co_capture_links_within_session() {
        let mut mem = SimpleMemory::new();
        mem.add("fact A").await.unwrap();
        mem.add("fact B").await.unwrap();
        assert!(mem.processor().stats().l2_edges > 0);
    }
}
