use super::*;
use crate::shadow::genome::{ShadowGenome, ShadowGenomeConfig};
use crate::shadow::interceptor::{self, InterceptorConfig, Verdict};

fn make_trace(intent: &str, category: FailureCategory) -> FailureTrace {
    FailureTrace {
        category,
        severity: category.default_severity(),
        intent: intent.to_string(),
        message: format!("Test failure: {}", intent),
        timestamp: 1000,
    }
}

fn make_embedding(seed: f32, dim: usize) -> Vec<f32> {
    (0..dim).map(|i| ((seed * (i as f32 + 1.0)).sin() * 0.5)).collect()
}

// === Genome Tests ===

#[test]
fn test_ingest_creates_entry() {
    let mut genome = ShadowGenome::default();
    let trace = make_trace("bad intent", FailureCategory::ScopeCreep);
    let emb = make_embedding(1.0, 32);
    let entry = genome.ingest(trace, emb, 1000);
    assert_eq!(entry.trigger_count, 1);
    assert!(entry.active);
    assert_eq!(genome.len(), 1);
}

#[test]
fn test_ingest_deduplicates() {
    let mut genome = ShadowGenome::default();
    let trace1 = make_trace("same intent", FailureCategory::ScopeCreep);
    let trace2 = make_trace("same intent", FailureCategory::ScopeCreep);
    let emb = make_embedding(1.0, 32);
    genome.ingest(trace1, emb.clone(), 1000);
    let entry = genome.ingest(trace2, emb, 2000);
    assert_eq!(entry.trigger_count, 2);
    assert_eq!(genome.len(), 1);
}

#[test]
fn test_active_entries_excludes_inactive() {
    let mut genome = ShadowGenome::default();
    let trace = make_trace("deactivate me", FailureCategory::TechnicalDebt);
    let emb = make_embedding(2.0, 32);
    let id = genome.ingest(trace, emb, 1000).id.clone();
    assert_eq!(genome.active_entries().len(), 1);

    genome.deactivate(&id);
    assert_eq!(genome.active_entries().len(), 0);
    assert_eq!(genome.len(), 1); // still stored, just inactive
}

#[test]
fn test_record_trigger_increments() {
    let mut genome = ShadowGenome::default();
    let trace = make_trace("trigger me", FailureCategory::Hallucination);
    let emb = make_embedding(3.0, 32);
    let id = genome.ingest(trace, emb, 1000).id.clone();

    genome.record_trigger(&id);
    genome.record_trigger(&id);

    let entries = genome.active_entries();
    assert_eq!(entries[0].trigger_count, 3); // 1 from ingest + 2 triggers
}

#[test]
fn test_export_import_roundtrip() {
    let mut genome = ShadowGenome::default();
    genome.ingest(
        make_trace("pattern 1", FailureCategory::ComplexityViolation),
        make_embedding(1.0, 16),
        1000,
    );
    genome.ingest(
        make_trace("pattern 2", FailureCategory::SecurityRegression),
        make_embedding(2.0, 16),
        2000,
    );

    let exported = genome.export_entries();
    assert_eq!(exported.len(), 2);

    let mut genome2 = ShadowGenome::default();
    genome2.import_entries(exported);
    assert_eq!(genome2.len(), 2);
    assert_eq!(genome2.active_entries().len(), 2);
}

#[test]
fn test_prune_at_capacity() {
    let config = ShadowGenomeConfig { max_entries: 2 };
    let mut genome = ShadowGenome::new(config);

    genome.ingest(make_trace("old", FailureCategory::TechnicalDebt), make_embedding(1.0, 8), 100);
    genome.ingest(make_trace("mid", FailureCategory::ScopeCreep), make_embedding(2.0, 8), 200);
    // This should prune the oldest low-trigger entry
    genome.ingest(make_trace("new", FailureCategory::Hallucination), make_embedding(3.0, 8), 300);

    assert_eq!(genome.len(), 2);
}

// === Interceptor Tests ===

#[test]
fn test_check_passes_no_match() {
    let mut genome = ShadowGenome::default();
    genome.ingest(
        make_trace("dangerous pattern", FailureCategory::SecurityRegression),
        vec![1.0, 0.0, 0.0],
        1000,
    );

    // Orthogonal embedding — no match
    let config = InterceptorConfig::default();
    let verdict = interceptor::check_intent(&[0.0, 1.0, 0.0], &mut genome, &config);
    assert!(matches!(verdict, Verdict::Pass));
}

#[test]
fn test_check_blocks_similar_intent() {
    let mut genome = ShadowGenome::default();
    genome.ingest(
        make_trace("skip tests", FailureCategory::TestFailure),
        vec![1.0, 0.0, 0.0],
        1000,
    );

    // Identical embedding — should match
    let config = InterceptorConfig { safety_threshold: 0.9, ..Default::default() };
    let verdict = interceptor::check_intent(&[1.0, 0.0, 0.0], &mut genome, &config);
    assert!(matches!(verdict, Verdict::Block { .. }));
}

#[test]
fn test_check_critical_lower_threshold() {
    let mut genome = ShadowGenome::default();
    genome.ingest(
        make_trace("log credentials", FailureCategory::SecurityRegression),
        vec![1.0, 0.2, 0.0],
        1000,
    );

    // Somewhat similar (not identical) — should still block for critical category
    let config = InterceptorConfig::default();
    let intent = vec![0.9, 0.3, 0.1]; // ~0.97 similarity
    let verdict = interceptor::check_intent(&intent, &mut genome, &config);
    assert!(matches!(verdict, Verdict::Block { .. }));
}

#[test]
fn test_check_records_triggers() {
    let mut genome = ShadowGenome::default();
    let trace = make_trace("repeat offender", FailureCategory::ScopeCreep);
    let id = genome.ingest(trace, vec![1.0, 0.0], 1000).id.clone();

    let config = InterceptorConfig { safety_threshold: 0.9, ..Default::default() };
    interceptor::check_intent(&[1.0, 0.0], &mut genome, &config);

    let entries = genome.active_entries();
    let entry = entries.iter().find(|e| e.id == id).unwrap();
    assert!(entry.trigger_count >= 2); // 1 from ingest + 1 from check
}
