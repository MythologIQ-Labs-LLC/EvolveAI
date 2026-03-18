use super::*;

#[test]
fn test_decay_no_time_elapsed() {
    let result = calculate_decay(1000, 1000, 60000, 1.0);
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_decay_one_half_life() {
    let result = calculate_decay(0, 60000, 60000, 1.0);
    assert!((result - 0.5).abs() < 1e-6);
}

#[test]
fn test_decay_two_half_lives() {
    let result = calculate_decay(0, 120_000, 60000, 1.0);
    assert!((result - 0.25).abs() < 1e-6);
}

#[test]
fn test_decay_negative_elapsed() {
    let result = calculate_decay(2000, 1000, 60000, 0.8);
    assert!((result - 0.8).abs() < 1e-6);
}

#[test]
fn test_decay_custom_base_factor() {
    let result = calculate_decay(0, 60000, 60000, 0.5);
    assert!((result - 0.25).abs() < 1e-6);
}

#[test]
fn test_should_prune_below_threshold() {
    assert!(should_prune(0.01, 0.05));
}

#[test]
fn test_should_not_prune_above_threshold() {
    assert!(!should_prune(0.5, 0.05));
}

#[test]
fn test_effective_strength_boost() {
    let result = effective_strength(0.5, 10, 0.1);
    // boost = 1.0 + min(10 * 0.1, 2.0) = 2.0
    // strength = min(0.5 * 2.0, 1.0) = 1.0
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_effective_strength_clamped() {
    let result = effective_strength(0.9, 100, 0.5);
    // boost capped at 3.0, but result clamped to 1.0
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_effective_strength_zero_access() {
    let result = effective_strength(0.5, 0, 0.1);
    // boost = 1.0, so result = 0.5
    assert!((result - 0.5).abs() < 1e-6);
}
