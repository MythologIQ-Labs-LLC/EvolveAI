# Plan: v7.0 Deterministic Policy Gate (BL-001)

Root of the AGT-sourced governance track: BL-001 unblocks BL-002
(per-phase interception), BL-003 (three-mode gating), and BL-007. This
plan implements BL-001 only. Target: <0.1 ms evaluation, zero LLM
inference, declarative rules.

## Open Questions

1. **Rule expressiveness v1**: exact-match / prefix / length / tag-set
   predicates only (no regex dependency, no scripting). Sufficient for
   triage per the AGT benchmark? Adding `regex` is a one-line change
   later but violates YAGNI now.
2. **Audit log destination**: plan uses a bounded in-memory ring + a
   JSONL append file under the state dir (`~/.evolve/policy-audit.jsonl`).
   Ledger integration deliberately out of scope (the ledger records
   memory state transitions, not request triage — keeping those
   un-complected).
3. **Denied-by-gate vs shadow genome**: a Deny is a policy outcome, not
   a failure; plan does NOT record denials into the genome. Confirm.

## Phase 1: Policy core (evolve-core)

### Affected Files

- `crates/evolve-core/src/policy/tests.rs` — **NEW**: rule/mode/latency tests first
- `crates/evolve-core/src/policy/mod.rs` — **NEW**: types + evaluation
- `crates/evolve-core/src/policy/rules.rs` — **NEW**: predicates + RuleSet
- `crates/evolve-core/src/lib.rs` — module export

### Changes

Value-oriented, no state: `PolicyContext<'a> { operation: OpKind
(Encode|Query|Ingest|Crystallize), content_len: usize, tags: &'a [String],
intent: Option<&'a str> }`. `Decision { verdict: Verdict
(Allow|Deny|AuditOnly), rule_id: Option<String>, reason: Option<String> }`.
`Rule { id, predicate: Predicate, action }` with `Predicate` as a closed
enum (ContentLenOver(usize), HasTag(String), IntentPrefix(String),
Always) — serde de/serializable so rule sets are data, loadable from
`~/.evolve/policy.json`. `Mode { Strict, Audit, Permissive }` decides
the default verdict when no rule matches and whether Deny is enforced or
logged. `PolicyGate::evaluate(&self, ctx) -> Decision` is a pure
function over an immutable `RuleSet` — no allocation on the hot path.
Default rule set: deny empty content, deny content_len > configured max,
audit-log `sensitive`-tagged ingests.

### Unit Tests

- `policy/tests.rs` — mode matrix (same ruleset under strict/audit/
  permissive), first-match-wins ordering, serde round-trip of RuleSet,
  default-ruleset behaviors, and a latency budget test (10k evaluations
  under a generous debug-build bound; the <0.1 ms claim is asserted in
  release via an ignored bench-style test).

## Phase 2: Facade integration (Phase-0 triage position)

### Affected Files

- `crates/evolve-core/src/processor/tests.rs` — gate-integration tests first
- `crates/evolve-core/src/processor/facade.rs` — evaluate before lifecycle
- `crates/evolve-core/src/processor/types.rs` — `ProcessorConfig.policy:
  PolicyConfig { mode, rules }`; new `EncodeError/QueryError` variant
  `PolicyDenied { rule_id, reason }`
- `crates/evolve-core/src/policy/audit.rs` — **NEW**: AuditSink trait +
  ring buffer impl; JSONL file sink lives in the frontends, not core

### Changes

`encode()`/`query()`/`ingest_file()` evaluate the gate BEFORE
`begin_lifecycle_op` — a denied request never starts a cognitive cycle
(that is BL-001's entire point: triage precedes metabolism). Denials
return the typed error; AuditOnly outcomes proceed while emitting an
`AuditEvent { ts, operation, verdict, rule_id }` to the configured
`AuditSink` (core ships the trait + in-memory ring; frontends attach
file sinks). Stats gains `policy: { evaluated, denied, audited }`
counters.

### Unit Tests

- strict mode denies before any phase transition (lifecycle stays Idle,
  no trace recorded, nothing enters L1); audit mode lets the same
  request through and logs; permissive allows unmatched; counters
  accumulate; PolicyDenied surfaces through SimpleMemory unchanged
  (compat check for CLI/Tauri).

## Phase 3: Frontend surfacing

### Affected Files

- `crates/evolve-cli/tests/cli.rs` — policy CLI tests first
- `crates/evolve-cli/src/…` — `policy show|mode <m>` commands; JSONL sink
- `src-tauri/src/commands_v3.rs`, `ui/api.ts`, `ui/panels.tsx` —
  `get_policy_stats` command + Policy card in the Metabolism section

### Changes

CLI loads `~/.evolve/policy.json` if present (else defaults), attaches
the JSONL audit sink, and exposes mode switching (writes config, takes
effect next invocation — no daemon state). Tauri mirrors: policy stats
in the UI, audit events visible via the existing stats polling.

### Unit Tests

- `cli.rs` — deny surfaces as a clean non-zero exit + message naming the
  rule; audit mode writes a JSONL line; mode switch persists.

## CI validation

Standing ci.yml gates; new tests ride `cargo test -p evolve-core -p
evolve-cli`. Release-mode latency assertion runs in the release.yml
dry-run job (`cargo test -p evolve-core --release policy -- --ignored`).
