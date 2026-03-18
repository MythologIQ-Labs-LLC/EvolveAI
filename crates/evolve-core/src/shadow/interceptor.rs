use crate::representation::similarity::cosine_similarity;
use crate::shadow::genome::ShadowGenome;
use crate::shadow::types::*;

/// Interceptor configuration.
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

/// Safety verdict from the interceptor.
#[derive(Clone, Debug)]
pub enum Verdict {
    Pass,
    Block {
        matched_ids: Vec<String>,
        reasoning: String,
    },
}

/// Check an intent embedding against the shadow genome.
/// Returns Pass if no patterns match, Block if similarity exceeds threshold.
pub fn check_intent(
    intent_embedding: &[f32],
    genome: &mut ShadowGenome,
    config: &InterceptorConfig,
) -> Verdict {
    let entries = genome.active_entries();
    let mut matches: Vec<(String, f32)> = Vec::new();

    for entry in &entries {
        let sim = cosine_similarity(intent_embedding, &entry.embedding);
        let threshold = effective_threshold(entry.category, config);

        if sim >= threshold {
            matches.push((entry.id.clone(), sim));
        }
    }

    if matches.is_empty() {
        return Verdict::Pass;
    }

    // Record triggers for all matches
    for (id, _) in &matches {
        genome.record_trigger(id);
    }

    matches.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    Verdict::Block {
        matched_ids: matches.iter().map(|(id, _)| id.clone()).collect(),
        reasoning: format!("Blocked: {} shadow pattern(s) matched", matches.len()),
    }
}

/// Critical categories use a lower threshold (70% of normal).
fn effective_threshold(category: FailureCategory, config: &InterceptorConfig) -> f32 {
    if config.critical_categories.contains(&category) {
        config.safety_threshold * 0.7
    } else {
        config.safety_threshold
    }
}
