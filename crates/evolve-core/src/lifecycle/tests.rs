use crate::lifecycle::orchestrator::{LifecycleConfig, Orchestrator};
use crate::lifecycle::types::*;

fn make_orchestrator() -> Orchestrator {
    Orchestrator::new("test-session".to_string(), LifecycleConfig::default())
}

fn make_trace(op: &str, success: bool) -> PipelineTrace {
    PipelineTrace {
        operation: op.to_string(),
        started_at: 1000,
        ended_at: 1010,
        success,
        error: None,
    }
}

#[test]
fn test_initial_state_is_idle() {
    let orch = make_orchestrator();
    assert_eq!(orch.phase(), Phase::Idle);
    assert_eq!(orch.state().session_id, "test-session");
}

#[test]
fn test_start_session_creates_budget() {
    let mut orch = make_orchestrator();
    orch.start_session(1000).unwrap();
    assert_eq!(orch.phase(), Phase::Idle);
    let budget = orch.state().budget.as_ref().unwrap();
    assert_eq!(budget.total_ops, 1000);
    assert_eq!(budget.remaining_ops, 1000);
}

#[test]
fn test_begin_operation_safety_pass() {
    let mut orch = make_orchestrator();
    orch.start_session(1000).unwrap();
    orch.begin_operation(true, 2000).unwrap();
    assert_eq!(orch.phase(), Phase::ActiveFlow);
}

#[test]
fn test_begin_operation_safety_block() {
    let mut orch = make_orchestrator();
    orch.start_session(1000).unwrap();
    orch.begin_operation(false, 2000).unwrap();
    assert_eq!(orch.phase(), Phase::Idle);
}

#[test]
fn test_record_operation_consumes_budget() {
    let mut orch = make_orchestrator();
    orch.start_session(1000).unwrap();
    orch.begin_operation(true, 2000).unwrap();

    let trace = make_trace("encode", true);
    orch.record_operation(trace).unwrap();

    let budget = orch.state().budget.as_ref().unwrap();
    assert_eq!(budget.remaining_ops, 999);
    assert_eq!(orch.trace_count(), 1);
}

#[test]
fn test_detach_below_threshold() {
    let config = LifecycleConfig { synthesis_threshold: 100, ..Default::default() };
    let mut orch = Orchestrator::new("s".into(), config);
    orch.start_session(1000).unwrap();
    orch.begin_operation(true, 2000).unwrap();
    orch.record_operation(make_trace("op", true)).unwrap();

    let should_synth = orch.detach(3000).unwrap();
    assert!(!should_synth);
    assert_eq!(orch.phase(), Phase::Idle);
}

#[test]
fn test_detach_above_threshold() {
    let config = LifecycleConfig { synthesis_threshold: 2, ..Default::default() };
    let mut orch = Orchestrator::new("s".into(), config);
    orch.start_session(1000).unwrap();
    orch.begin_operation(true, 2000).unwrap();
    orch.record_operation(make_trace("op1", true)).unwrap();
    orch.record_operation(make_trace("op2", true)).unwrap();

    let should_synth = orch.detach(3000).unwrap();
    assert!(should_synth);
    assert_eq!(orch.phase(), Phase::RemSynthesis);
}

#[test]
fn test_complete_synthesis_returns_traces() {
    let config = LifecycleConfig { synthesis_threshold: 1, ..Default::default() };
    let mut orch = Orchestrator::new("s".into(), config);
    orch.start_session(1000).unwrap();
    orch.begin_operation(true, 2000).unwrap();
    orch.record_operation(make_trace("op", true)).unwrap();
    orch.detach(3000).unwrap();

    let traces = orch.complete_synthesis(4000).unwrap();
    assert_eq!(traces.len(), 1);
    assert_eq!(traces[0].operation, "op");
    assert_eq!(orch.phase(), Phase::Idle);
    assert_eq!(orch.trace_count(), 0);
}

#[test]
fn test_invalid_phase_returns_error() {
    let mut orch = make_orchestrator();
    // Can't begin_operation without start_session first (still Idle, but budget not set)
    // Can't detach from Idle
    let result = orch.detach(1000);
    assert!(result.is_err());
}

#[test]
fn test_reset_clears_state() {
    let mut orch = make_orchestrator();
    orch.start_session(1000).unwrap();
    orch.begin_operation(true, 2000).unwrap();
    orch.record_operation(make_trace("op", true)).unwrap();

    orch.reset(5000);
    assert_eq!(orch.phase(), Phase::Idle);
    assert_eq!(orch.trace_count(), 0);
}

#[test]
fn test_has_budget_tracks_ops() {
    let config = LifecycleConfig {
        default_ops_budget: 2,
        default_time_budget_ms: 60_000,
        synthesis_threshold: 10,
    };
    let mut orch = Orchestrator::new("s".into(), config);
    orch.start_session(1000).unwrap();
    assert!(orch.has_budget(1000));

    orch.begin_operation(true, 2000).unwrap();
    orch.record_operation(make_trace("op1", true)).unwrap();
    orch.record_operation(make_trace("op2", true)).unwrap();
    assert!(!orch.has_budget(2000));
}

#[test]
fn test_transitions_recorded() {
    let mut orch = make_orchestrator();
    orch.start_session(1000).unwrap();
    let transitions = &orch.state().transitions;
    // start_session: Idle→Grounding, Grounding→Idle = 2 transitions
    assert_eq!(transitions.len(), 2);
    assert_eq!(transitions[0].from, Phase::Idle);
    assert_eq!(transitions[0].to, Phase::Grounding);
    assert_eq!(transitions[1].from, Phase::Grounding);
    assert_eq!(transitions[1].to, Phase::Idle);
}
