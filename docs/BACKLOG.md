# EvolveAI Backlog

## Source: Comparative Architecture Research (2026-03-18)

Research artifacts:
- [EVOLVEAI-VS-MENGRAM-ANALYSIS.md](Research/EVOLVEAI-VS-MENGRAM-ANALYSIS.md)
- [AGT-GOVERNANCE-COMPARISON.md](Research/AGT-GOVERNANCE-COMPARISON.md)
- [CMHL-UOR-CONVERGENCE.md](Research/CMHL-UOR-CONVERGENCE.md)

---

## 🔴 Priority: Critical (AGT-Sourced)

### BL-001: Deterministic Policy Gate (Phase 0 Triage)

**Source**: Microsoft Agent Governance Toolkit — Policy Engine
**Supersedes**: marlandoj's LLM gate pattern (5-7s latency)

Add a deterministic, rule-based triage gate that runs **before** the 5-phase metabolic lifecycle begins. Filters out prompts that don't warrant a full cognitive cycle.

- **Target latency**: <0.1ms (AGT benchmark)
- **Implementation**: Declarative policy rules, not LLM inference
- **Modes**: `strict` (deny by default), `audit` (log only), `permissive` (allow by default)
- **Rationale**: 50,000× faster than an LLM classifier gate. marlandoj's pattern proved the *concept* of gating; AGT proves the *implementation* should be deterministic.

**Acceptance criteria**:
- [ ] PolicyGate trait with evaluate() returning Allow/Deny/Audit
- [ ] Default rule set for trivial message filtering
- [ ] Audit mode logs what would be blocked without blocking
- [ ] Integrates before Phase 1 (Grounding) in lifecycle orchestrator

---

### BL-002: Pervasive Per-Phase Policy Interception

**Source**: Microsoft Agent Governance Toolkit — Action Interception pattern
**Supersedes**: Single-point Phase 0 gating recommendation

Extend the policy gate from BL-001 across all 5 lifecycle phases, not just at the entry point. Every phase should have a policy checkpoint.

- **Phase 0**: Triage Gate — "Does this warrant a cognitive cycle?"
- **Phase 1**: Grounding Gate — "Is this identity/session authorized?"
- **Phase 2**: Semantic Pause — Shadow Genome (already exists)
- **Phase 3**: Active Flow Gate — "Is this specific memory operation allowed?"
- **Phase 4**: Detachment Gate — "Should we persist this state?"
- **Phase 5**: REM Gate — "Should this learning be crystallized?"

**Acceptance criteria**:
- [ ] PolicyInterceptor trait callable from each lifecycle phase
- [ ] Phase-specific rule contexts (different rules for encode vs query vs crystallize)
- [ ] Unified audit log across all phase checkpoints

---

### BL-003: Three-Mode Gating (Strict / Audit / Permissive)

**Source**: Microsoft Agent Governance Toolkit — Policy Modes
**Supersedes**: marlandoj's two-mode pattern (gated / ungated)

Implement three enforcement modes for all policy checkpoints:

| Mode | Behavior | Use case |
|------|----------|----------|
| `strict` | Deny by default; explicitly allow | Production |
| `audit` | Allow everything but log decisions | Debugging, tuning rules |
| `permissive` | Allow by default; explicitly deny | Development, break-glass |

**Rationale**: marlandoj's break-glass ungated endpoint drops all safety. AGT's `audit` mode lets you *see* what would be blocked without actually dropping the guard.

**Acceptance criteria**:
- [ ] PolicyMode enum: Strict, Audit, Permissive
- [ ] Mode configurable per-phase and globally
- [ ] Audit mode produces structured decision logs

---

### BL-004: Multi-Model Verification as Fiber Pinning (CMVK Pattern)

**Source**: Microsoft Agent Governance Toolkit — Cross-Model Verification Kernel (ASI-06)
**Supersedes**: marlandoj's supersession links (ad-hoc confidence halving)

Implement cross-model claim verification as a formal fiber pinning mechanism:

- When CMVK confirms a claim across 2+ models → **high-weight fiber pin** (temperature drops, decay slows)
- When CMVK detects conflict → **entropy injection** (fibers unpinned, temperature spikes, decay accelerates)
- Maps directly to UOR thermodynamic model from CMHL-UOR-CONVERGENCE.md

**Rationale**: marlandoj's supersession links are reactive (detect contradiction after the fact, halve confidence). CMVK is proactive (verify before accepting). Both are useful; CMVK is the stronger primitive.

**Acceptance criteria**:
- [ ] VerificationEngine trait with verify() accepting claim + model list
- [ ] Verification result maps to FiberPinEvent or EntropyInjectionEvent
- [ ] Integrates with existing FiberState in MemoryUnit (plan-v5.0)
- [ ] Fallback to single-model accept when verification unavailable

---

## 🟡 Priority: High (AGT-Sourced)

### BL-005: Trust Scoring with Decay for Agent Identity

**Source**: Microsoft Agent Governance Toolkit — AgentMesh Trust Scoring
**Completes**: EvolveAI's theoretical Agent Stability Index (ASI)

Implement AGT's 0-1000 trust scoring model as a production version of the ASI concept from the Autopoietic Memory Theory:

| Score Range | Tier | Mapping to Memory |
|-------------|------|-------------------|
| 900-1000 | Verified | Agent with mostly L3 memories (high σ) |
| 700-899 | Trusted | Agent with stable L2 knowledge |
| 500-699 | Standard | Default new agent |
| 300-499 | Probationary | Agent with recent failures |
| 0-299 | Untrusted | Agent with broken chain or poisoned memory |

- Trust decay without positive signals (same math as CMHL)
- Memory chain integrity failure → immediate trust penalty
- Memory saturation state feeds trust baseline

**Acceptance criteria**:
- [ ] TrustScore struct with value, tier, last_updated
- [ ] Decay function mirroring CMHL: trust_eff = trust₀ × e^(-λ_trust × t)
- [ ] Positive signal events: successful task, verified memory, chain validation
- [ ] Negative signal events: policy violation, chain break, Shadow Genome trigger

---

### BL-006: Human-in-the-Loop for L3 Crystallization

**Source**: Microsoft Agent Governance Toolkit — Approval Workflows (ASI-09)

When a memory is about to crystallize to L3 (permanent, λ = 0), optionally require human approval before committing to immutability.

- Configurable: auto-crystallize (default) vs approval-required
- Quorum support: critical memories may require multiple approvals
- Expiration: approval requests time out to prevent stale authorizations

**Acceptance criteria**:
- [ ] ApprovalGate trait with request_approval() / check_status()
- [ ] Configurable per-tier threshold (e.g., only L3 requires approval)
- [ ] Timeout with configurable expiration
- [ ] Integrates with REM Synthesis phase (Phase 5)

---

### BL-007: OPA/Rego Policy Export for Shadow Genome

**Source**: Microsoft Agent Governance Toolkit — OPA/Rego + Cedar support

When Shadow Genome failure patterns crystallize (reach high confidence through repeated encounters), export them as auditable OPA/Rego or Cedar policy files.

- Learned rules become enterprise-grade policy artifacts
- Security teams can review, modify, and version-control crystallized safety rules
- Bridges the gap between emergent learning and deterministic enforcement

**Acceptance criteria**:
- [ ] ShadowGenome method: export_crystallized_to_rego() → String
- [ ] Exported policies are valid OPA/Rego syntax
- [ ] Round-trip: exported policy can be loaded back into PolicyGate (BL-001)
- [ ] Only exports patterns with confidence above configurable threshold

---

### BL-008: Shapley-Value Fault Attribution for Multi-Agent Memory

**Source**: Microsoft Agent Governance Toolkit — Rogue Agent Detection (ASI-10)

When a swarm of agents produces a bad outcome, identify which agent's memory contributed to the failure using Shapley-value attribution.

**Acceptance criteria**:
- [ ] FaultAttribution module with shapley_value() function
- [ ] Input: set of agent memory contributions + outcome quality score
- [ ] Output: per-agent blame score (0.0-1.0)
- [ ] Feeds into trust scoring (BL-005): blamed agents lose trust

---

### BL-009: SLO / Error Budget Framework for Memory Reliability

**Source**: Microsoft Agent Governance Toolkit — Agent SRE

Define formal SLOs for memory system reliability:

| SLO | Target | Meaning |
|-----|--------|---------|
| Recall accuracy | ≥ 95% | Retrieved memories are relevant to query |
| Chain integrity | 100% | No hash chain breaks |
| Decay correctness | ≥ 99% | Decayed weights match formula predictions |
| L3 permanence | 100% | Crystallized memories never lost |
| Retrieval latency (L3) | < 1ms | O(1) hash lookups |
| Retrieval latency (L1/L2) | < 50ms | Vector search within budget |

Error budgets: when SLO is violated, trigger automatic intervention (e.g., pause crystallization, increase decay λ_base, circuit-break queries).

**Acceptance criteria**:
- [ ] SloTracker struct with thresholds and current measurements
- [ ] Error budget calculation: remaining = target - actual
- [ ] Circuit breaker: auto-triggered when error budget exhausted
- [ ] Integrates with lifecycle orchestrator (halt when reliability degraded)

---

## 🟢 Priority: Standard (Mengram / marlandoj-Sourced)

### BL-010: Cognitive Profile Generator

**Source**: Mengram — `get_profile()`

Auto-generate a system prompt summary from all accumulated memories. Similar to EvolveAI's Soul File concept but dynamically derived rather than manually authored.

**Acceptance criteria**:
- [ ] profile() method on NeuralNetProcessor
- [ ] Aggregates L2 + L3 memories into natural language summary
- [ ] Includes: identity, preferences, tech stack, recent context, known constraints
- [ ] Usable as LLM system prompt injection

---

### BL-011: File Ingestion Pipeline

**Source**: Mengram — `add_file()`

Support ingesting external documents (PDF, markdown, text) into the memory pipeline with automatic encoding and tier routing.

**Acceptance criteria**:
- [ ] ingest_file() method accepting file path
- [ ] Parser support: .md, .txt, .pdf (via external extraction)
- [ ] Automatic chunking → encoding → MTS routing → tier placement
- [ ] Metadata preservation: source file, page number, ingestion timestamp

---

### BL-012: Co-Capture Linking

**Source**: marlandoj/SpiceyBacon — auto-linking facts from the same session

When multiple memories are encoded in the same session/cycle, automatically create L2 graph edges between them.

**Acceptance criteria**:
- [ ] Session-scoped memory collection during Active Flow phase
- [ ] Automatic edge creation between co-encoded memories
- [ ] Edge weight: proportional to temporal proximity within session
- [ ] <1ms overhead per link (marlandoj benchmark)

---

### BL-013: Swarm Token Budget Gating

**Source**: marlandoj/SpiceyBacon — multi-agent swarm optimization

In multi-agent scenarios, prevent token budget exhaustion by gating retrieval per-agent. Without gating, 11+ agents each inject full memory context every turn.

**Acceptance criteria**:
- [ ] SwarmBudget struct: total_tokens, per_agent_limit, remaining
- [ ] Gate: skip retrieval when agent's token budget exhausted for this cycle
- [ ] Priority-based allocation: higher-trust agents get larger token budgets
- [ ] Integrates with trust scoring (BL-005) for dynamic budget allocation

---

### BL-014: Simplified Developer API (Ergonomic Facade)

**Source**: Mengram — 3-method API (`add` / `search` / `procedure_feedback`)

Create a simplified API layer over the full NeuralNetProcessor for developers who don't need lifecycle control.

**Acceptance criteria**:
- [ ] SimpleMemory struct with: add(), search(), feedback()
- [ ] Internally delegates to full processor lifecycle
- [ ] Default configuration that "just works" without lifecycle understanding
- [ ] Preserves full processor access for power users

---

## Status

| ID | Item | Priority | Status | Depends On |
|----|------|----------|--------|------------|
| BL-001 | Deterministic Policy Gate | 🔴 Critical | OPEN | — |
| BL-002 | Per-Phase Policy Interception | 🔴 Critical | OPEN | BL-001 |
| BL-003 | Three-Mode Gating | 🔴 Critical | OPEN | BL-001 |
| BL-004 | CMVK Fiber Pinning | 🔴 Critical | PARTIAL (v5.1 — primitives complete) | plan-v5.0 |
| BL-005 | Trust Scoring | 🟡 High | OPEN | BL-001 |
| BL-006 | L3 Approval Workflows | 🟡 High | OPEN | — |
| BL-007 | Rego Policy Export | 🟡 High | OPEN | BL-001 |
| BL-008 | Shapley Fault Attribution | 🟡 High | OPEN | BL-005 |
| BL-009 | SLO / Error Budgets | 🟡 High | OPEN | — |
| BL-010 | Cognitive Profile | 🟢 Standard | OPEN | — |
| BL-011 | File Ingestion | 🟢 Standard | OPEN | — |
| BL-012 | Co-Capture Linking | 🟢 Standard | COMPLETE (v5.2) | — |
| BL-013 | Swarm Token Budget | 🟢 Standard | OPEN | BL-005 |
| BL-014 | Simplified API | 🟢 Standard | COMPLETE (v5.3) | — |

---

*Backlog generated from comparative research. All items are advisory — architectural decisions remain with the Governor.*
