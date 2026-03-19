use crate::memory::types::PinningEvent;

/// Context temperature derived from saturation.
/// T_ctx = (1 - σ) × ln(2)
pub fn temperature(saturation: f32) -> f32 {
    (1.0 - saturation.clamp(0.0, 1.0)) * std::f32::consts::LN_2
}

/// Effective decay constant: λ_eff = λ_base × T_ctx
pub fn effective_lambda(base_lambda: f32, saturation: f32) -> f32 {
    base_lambda * temperature(saturation)
}

/// Thermodynamic CMHL decay: w = e^(-λ_eff × elapsed)
pub fn calculate_decay(
    last_accessed: i64,
    current_time: i64,
    half_life_ms: i64,
    saturation: f32,
) -> f32 {
    let elapsed = current_time - last_accessed;
    if elapsed <= 0 {
        return 1.0;
    }
    let base_lambda = std::f32::consts::LN_2 / half_life_ms as f32;
    let lambda_eff = effective_lambda(base_lambda, saturation);
    (-lambda_eff * elapsed as f32).exp()
}

/// Check if a memory should be pruned based on its decay weight.
pub fn should_prune(decay_weight: f32, threshold: f32) -> bool {
    decay_weight < threshold
}

/// Boost saturation by access count (uniform weight).
/// σ' = 1 - (1 - σ) × e^(-boost_rate × accesses)
pub fn boost_saturation(current: f32, access_count: u32, boost_rate: f32) -> f32 {
    let remaining = 1.0 - current;
    let pinned = remaining * (1.0 - (-boost_rate * access_count as f32).exp());
    (current + pinned).min(1.0)
}

/// Weight of a pinning event. Higher = more fibers pinned.
pub fn pin_weight(event: PinningEvent) -> f32 {
    match event {
        PinningEvent::Access => 0.01,
        PinningEvent::CrossReference => 0.05,
        PinningEvent::Corroboration => 0.05,
        PinningEvent::CryptoVerification => 0.15,
    }
}

/// Boost saturation by a weighted pinning event.
/// σ' = 1 - (1 - σ) × e^(-weight)
pub fn boost_saturation_weighted(current: f32, event: PinningEvent) -> f32 {
    let weight = pin_weight(event);
    let remaining = 1.0 - current;
    let pinned = remaining * (1.0 - (-weight).exp());
    (current + pinned).min(1.0)
}

/// Inject entropy, unpinning fibers. Reduces σ by severity.
/// Non-finite severity is treated as 0.0 (no change).
pub fn inject_entropy(current: f32, severity: f32) -> f32 {
    if !severity.is_finite() {
        return current;
    }
    (current - severity.clamp(0.0, 1.0)).max(0.0)
}
