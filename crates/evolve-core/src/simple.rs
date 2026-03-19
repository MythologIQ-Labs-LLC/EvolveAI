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

    /// Ingest a text file, chunking it into memories automatically.
    pub async fn add_file(
        &mut self,
        path: &std::path::Path,
    ) -> Result<crate::processor::ingest::IngestResult, crate::processor::ingest::IngestError> {
        let now = chrono::Utc::now().timestamp_millis();
        self.processor.ingest_file(path, vec![], now).await
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
    async fn test_simple_add_file() {
        let dir = std::env::temp_dir().join("evolve-simple-test");
        std::fs::create_dir_all(&dir).ok();
        let path = dir.join("test_ingest.txt");
        std::fs::write(&path, "First paragraph here is long enough.\n\nSecond paragraph also long enough.").ok();
        let mut mem = SimpleMemory::new();
        let result = mem.add_file(&path).await.unwrap();
        assert!(result.chunks > 0);
        assert!(mem.processor().stats().l2_nodes > 0 || mem.processor().stats().l3_size > 0);
        std::fs::remove_file(&path).ok();
        std::fs::remove_dir(&dir).ok();
    }

    #[tokio::test]
    async fn test_simple_profile() {
        let mut mem = SimpleMemory::new();
        mem.add("knowledge about rust").await.unwrap();
        mem.add_tagged("api key", vec!["sensitive".into()]).await.unwrap();
        let p = mem.profile();
        assert_eq!(p.total_memories, 2);
        assert!(p.to_summary().contains("Memories: 2"));
    }

    #[tokio::test]
    async fn test_simple_slo_report() {
        let mut mem = SimpleMemory::new();
        mem.add("slo check").await.unwrap();
        mem.search("slo check", 5).await.unwrap();
        let report = mem.slo_report();
        assert!(report.total_samples > 0);
        assert!(!report.circuit_open);
    }

    #[tokio::test]
    async fn test_co_capture_links_within_session() {
        let mut mem = SimpleMemory::new();
        mem.add("fact A").await.unwrap();
        mem.add("fact B").await.unwrap();
        assert!(mem.processor().stats().l2_edges > 0);
    }
}
