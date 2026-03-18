use evolve_core::processor::facade::MemoryProcessor;
use evolve_core::processor::types::ProcessorConfig;
use evolve_core::representation::mock::MockEngine;
use tokio::sync::Mutex;

/// Concrete processor type for the Tauri app.
pub type AppProcessor = MemoryProcessor<MockEngine>;

/// Initialize the processor with default config.
pub fn create_processor() -> Mutex<AppProcessor> {
    let engine = MockEngine::new(384);
    let config = ProcessorConfig::default();
    Mutex::new(MemoryProcessor::new(engine, config))
}
