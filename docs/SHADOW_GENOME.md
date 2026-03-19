# Shadow Genome — Failure Pattern Archive

---

## Failure Entry #1

**Date**: 2026-03-18T13:30:00Z
**Verdict ID**: Entry #49
**Failure Mode**: COMPLEXITY_VIOLATION

### What Failed

v5.1 plan proposed adding `record_access()` and `record_conflict()` to `processor/facade.rs` without accounting for the file's current size (250 lines — already at Section 4 limit).

### Why It Failed

facade.rs was brought to exactly 250 lines during v5.0 implementation. The v5.1 plan specified +23 lines of additions without specifying any corresponding extraction to maintain the constraint.

### Pattern to Avoid

When planning additions to a file at or near the 250-line limit, the plan MUST specify what to extract or refactor to make room. Never assume "we'll figure it out during implementation."

### Remediation Attempted

RESOLVED — Phase 0 added to plan: extract `snapshot()`, `restore()`, `save_to_file()`, `load_from_file()` to `processor/persist.rs` as free functions. Frees 27 lines from facade.rs. Revised plan projects facade.rs at ~247 lines after all additions. Re-audit PASSED (Entry #50).

---

## Failure Entry #2

**Date**: 2026-03-19T04:30:00Z
**Verdict ID**: Entry #72 (initial VETO)
**Failure Mode**: COMPLEXITY_VIOLATION

### What Failed

v5.7 plan proposed adding `approve_crystallization()` and `add_trusted()` to simple.rs (250 lines) without extraction. Projected 259 lines.

### Why It Failed

simple.rs was at exactly 250 lines (the ceiling). Plan Open Question 3 acknowledged the problem but did not specify the fix — "convert to module directory" was a vague handwave, not a concrete extraction plan.

### Pattern to Avoid

When a file is at 250 lines, EVERY plan that touches it must include a concrete extraction phase. Vague open questions about "maybe extract later" are insufficient — specify the extraction in the plan.

### Remediation Attempted

RESOLVED — Phase 0a added: extract 12 inline tests (106 lines) from simple.rs to simple/tests.rs. Brings simple/mod.rs to ~144 lines with 106 lines headroom. Re-audit PASSED.
