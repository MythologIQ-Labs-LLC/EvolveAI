# CMHL × UOR Convergence: Unified Cryptographic Memory Thermodynamics

**Date**: 2026-03-18
**Author**: QoreLogic Analyst (Deep Analysis)
**Scope**: How UOR's algebraic framework unifies with CMHL memory half-life, and where existing cryptographic infrastructure can be shared to eliminate redundancy

---

## 1. The Convergence Thesis

EvolveAI currently maintains three separate cryptographic/mathematical systems that are doing overlapping work:

| System | Current Role | Crypto Primitive |
|--------|-------------|-----------------|
| **CMHL Decay** | Time-based memory relevance | Exponential half-life formula |
| **Chain Ledger** | Integrity verification | SHA-256 hash chain |
| **Content Hash** | Data deduplication | SHA-256 of serialized bytes |

UOR introduces a fourth:

| System | UOR Role | Crypto Primitive |
|--------|---------|-----------------|
| **Universal Digest** | Content-addressed identity | BLAKE3 → Braille encoding |
| **Fiber Budget** | Resolution completeness tracking | Bit-level pinning state |
| **Context Temperature** | Thermodynamic decay model | `T_ctx = freeCount × ln(2) / n` |

**The insight**: These aren't six different systems. They're three views of the same underlying reality. UOR provides the mathematical framework to unify them.

---

## 2. The Three Unifications

### 2.1 Identity × Integrity (Hash Unification)

**Current state**: Two separate hash operations:
- `content_hash(data)` → SHA-256 for deduplication (`chain/hash.rs`)
- `compute_block_hash(index, timestamp, data_hash, previous_hash)` → SHA-256 for chain integrity

**UOR state**: One hash operation:
- `Address = BLAKE3(canonical_bytes)` → content identity IS integrity

**The unification**: Replace both SHA-256 operations with a single BLAKE3 content-addressing pipeline. The UOR Address of a MemoryUnit simultaneously serves as:
1. Its **identity** (permanent, content-derived — replaces UUID)
2. Its **integrity proof** (hash changes if content changes — replaces separate chain hash)
3. Its **deduplication key** (same content = same address — replaces content_hash field)

**Performance gain**: BLAKE3 is ~3-6x faster than SHA-256 on modern hardware, and we eliminate one hash operation per memory write (currently: hash content + hash block = 2 ops → unified: hash content once = 1 op).

```
BEFORE (3 hashes per memory write):
  SHA-256(content)         → content_hash field
  SHA-256(serialized_unit) → chain data_hash
  SHA-256(block_components) → chain block hash

AFTER (2 hashes per memory write):
  BLAKE3(canonical_bytes)    → UOR Address (identity + dedup)
  BLAKE3(address + previous) → chain link (integrity)
```

The chain ledger still exists but becomes lighter — it links UOR Addresses, not raw data hashes. Each block stores just the Address of the memory operation, not a re-hash of the content.

### 2.2 Decay × Saturation (Thermodynamic Unification)

This is the deepest convergence and the answer to your core question.

**Current CMHL model**:
```
w_current = w₀ × e^(-λ(t - t₀))
```

This is pure time decay — a memory's relevance drops exponentially regardless of what happens to it. The only inputs are time elapsed and the decay constant λ.

**UOR's thermodynamic model**:
```
T_ctx = freeCount × ln(2) / n        (Context Temperature)
S     = (Σκ_k - χ(N(C))) × ln(2)     (Residual Entropy)
σ     = pinnedCount / totalFibers      (Saturation Degree)
```

These measure something fundamentally different: not *how old* a memory is, but *how resolved* it is. A fully-resolved memory (σ = 1, all fibers pinned) has temperature zero and will never decay, regardless of age. An unresolved memory (many free fibers) has high temperature and high entropy — it's thermodynamically unstable.

**The unified model** combines both:

```
w_effective = w₀ × e^(-λ_eff × (t - t₀))

where:
  λ_eff = λ_base × T_ctx
        = λ_base × (freeCount × ln(2) / n)
```

**What this means in plain English**: A memory's decay rate is proportional to its *unresolvedness*.

- **L3 vault entry** (fully crystallized, σ = 1, T_ctx = 0): `λ_eff = 0` → **no decay**. This is your thesis's "λ = 0 for L3." UOR provides the *mathematical justification* for why L3 memories don't decay — they're at thermodynamic ground state.

- **L2 graph node** (partially resolved, σ ≈ 0.5, T_ctx moderate): `λ_eff = λ_base × T_ctx` → **moderate decay**. The memory is semi-stable — some fibers are pinned (we know some things about it), but uncertainty remains.

- **L1 cache entry** (barely resolved, σ ≈ 0, T_ctx ≈ ln(2)): `λ_eff = λ_base × ln(2)` → **fast decay**. Maximum uncertainty, maximum volatility. This is ephemeral by nature.

**The key realization**: Your CMHL decay constant λ is not a fixed parameter assigned at creation — it should be *derived from the memory's fiber saturation state*. As a memory accumulates more constraints (gets accessed, cross-referenced, verified), its fibers get pinned, its temperature drops, its effective decay rate decreases, and eventually it crystallizes to L3 with λ = 0.

This is **Epistemic Crystallization** with a formal thermodynamic basis.

### 2.3 Fiber Budget × Lifecycle (Resource Unification)

**Current state**: Two separate resource tracking systems:
- `FiberBudget { total_ops, remaining_ops, time_budget_ms }` — lifecycle operations budget
- No per-memory resolution tracking

**UOR state**: `FiberBudget` tracks resolution at the *data* level:
- `total_fibers = n` (quantum level, bit width)
- `pinned_count` = fibers determined by constraints
- `free_count` = fibers still uncertain

**The unification**: The lifecycle's FiberBudget and UOR's FiberBudget are the same concept at different scales:

| Scale | What's Being Resolved | Fibers |
|-------|----------------------|--------|
| **Per-memory** | How resolved is this specific memory? | n bits of the datum |
| **Per-session** | How much work can this session do? | Operations remaining |
| **Per-context** | How saturated is the total knowledge state? | All memories' fiber states |

The session-level budget *consumes* fiber resolution capacity. Each operation either:
- **Pins fibers** (adds constraints to a memory → moves it toward crystallization)
- **Queries pinned fibers** (reads resolved state → free, no budget cost at saturation)

This gives the lifecycle a *thermodynamic interpretation*: the 5-phase metabolic cycle is a heat engine.

```
GROUNDING      → Set initial temperature (establish context, allocate fibers)
SEMANTIC PAUSE → Entropy check (is this operation going to increase or decrease system entropy?)
ACTIVE FLOW    → Work phase (pin fibers, reduce entropy, consume budget)
DETACHMENT     → Measure residual entropy (how much was resolved this cycle?)
REM SYNTHESIS  → Consolidation (batch-crystallize high-saturation memories to L3)
```

The REM Synthesis phase becomes especially elegant: it's the phase where the system identifies memories whose saturation σ has crossed a threshold, pins their remaining fibers (perhaps via cross-referencing or verification), and crystallizes them. In thermodynamic terms, it's the system reaching thermal equilibrium and precipitating crystals from a supersaturated solution — which is exactly the metaphor your thesis already uses.

---

## 3. Eliminating Redundant Cryptographic Work

Here's where performance optimization meets architectural elegance. Currently, evolve-core performs these cryptographic operations:

| Operation | When | Cost |
|-----------|------|------|
| SHA-256 content hash | Every encode | ~1μs |
| SHA-256 block hash | Every L3 store | ~1μs |
| SHA-256 chain verify | Every restore | ~1μs × chain length |
| Cosine similarity | Every query × candidates | ~10μs × N |
| SHA-256 shadow ID | Every shadow ingest | ~1μs |

With UOR integration:

| Operation | When | Cost | Replaces |
|-----------|------|------|----------|
| BLAKE3 content address | Every encode | ~0.3μs | Content hash + UUID generation + shadow ID |
| BLAKE3 chain link | Every L3 store | ~0.3μs | Block hash |
| BLAKE3 chain verify | Every restore | ~0.3μs × chain length | SHA-256 verify |
| Fiber saturation check | Every query | ~0.01μs (bit count) | Part of decay calc |
| Cosine similarity | Only for L1/L2 queries | ~10μs × N | Same, but L3 doesn't need it |

**The big win**: L3 (saturated, σ = 1) memories don't need cosine similarity at all. Their UOR Address IS their identity. Query for an L3 memory is an O(1) hash lookup, not an O(N) vector scan. This is UOR's "saturation ground state" — once a memory reaches T_ctx = 0, all queries resolve in constant time.

For L1/L2 (unsaturated) memories, you still need similarity search because the content isn't fully resolved. But as memories accumulate access patterns and cross-references (pinning fibers), they migrate toward L3 and eventually exit the similarity-search pool entirely.

**The decay-driven migration path**:

```
L1 (σ ≈ 0, T_ctx high, λ_eff large)
  ↓ access patterns pin fibers, temperature drops
L2 (σ ≈ 0.5, T_ctx moderate, λ_eff moderate)
  ↓ cross-references + verification pin remaining fibers
L3 (σ = 1, T_ctx = 0, λ_eff = 0, query = O(1))
```

This naturally solves the "hot path" optimization: the memories you query most often are the ones that get their fibers pinned fastest, which means they reach L3 saturation fastest, which means they exit the expensive similarity-search pool and become O(1) lookups. **Frequency of access drives crystallization drives performance improvement.** The system optimizes itself.

---

## 4. The Unified Memory Object

Combining all three unifications, a v5.0 MemoryUnit would look like:

```rust
struct MemoryUnit {
    // === UOR Identity (replaces uor_id: Uuid + content_hash: String) ===
    address: UorAddress,              // BLAKE3 content-addressed, permanent
    canonical_bytes: Vec<u8>,         // Deterministic serialization
    quantum_level: QuantumLevel,      // Bit width (Q0=8, Q1=16, Q2=24, Q3=32)

    // === Fiber State (replaces decay_factor: f32) ===
    fiber_state: FiberState,          // Which bits are pinned vs free
    saturation: f32,                  // σ = pinned / total (derived)
    temperature: f32,                 // T_ctx = free × ln(2) / n (derived)

    // === Temporal Metadata (unchanged concept, derived λ) ===
    created_at: i64,
    last_accessed: i64,
    access_count: u32,
    // λ_eff is COMPUTED as: λ_base × temperature
    // w_current is COMPUTED as: w₀ × e^(-λ_eff × elapsed)

    // === Classification (enriched by UOR partition) ===
    partition_class: PartitionClass,  // Irreducible | Reducible | Unit | Exterior
    tier: Tier,                       // L1 | L2 | L3 (derived from saturation)

    // === Content ===
    content: String,
    metadata: UnitMetadata,
}

struct FiberState {
    total: u32,                       // = quantum_level bits
    pinned: BitVec,                   // Which fibers are determined
    constraints: Vec<Constraint>,     // What pinned each fiber
}
```

The key changes:
1. **Identity is content-derived** (UorAddress, not UUID)
2. **Decay is saturation-derived** (fiber pinning, not fixed λ)
3. **Tier is saturation-derived** (L3 when σ = 1, not heuristic MTS)
4. **L3 queries are O(1)** (hash lookup, not vector scan)

---

## 5. What This Means for the Existing Chain

The hash chain ledger doesn't go away — it evolves. Currently:

```
Block { index, timestamp, data_hash: SHA-256(content), previous_hash, hash }
```

With UOR:

```
Block { index, timestamp, address: UorAddress, transition: FiberDelta, previous_hash, hash }
```

Each block now records not just *what* was stored, but *how the system's fiber state changed*. The `FiberDelta` captures which fibers were pinned and by what constraint. This makes the chain a **complete thermodynamic history** — you can replay the chain and reconstruct the exact saturation trajectory of every memory.

This is enormously powerful for debugging and auditing: instead of just knowing "memory X was created at time T," you know "memory X's fiber 7 was pinned by constraint C at time T1, fiber 12 was pinned by cross-reference R at time T2, and it reached saturation at time T3."

---

## 6. Folding in the Shadow Genome

The Shadow Genome currently stores failure patterns with embeddings for similarity matching. With UOR:

1. **Failure patterns get UOR Addresses** — content-addressed, permanent
2. **The interceptor can use Address matching for L3-crystallized failures** — O(1) exact match instead of O(N) cosine similarity
3. **New/uncertain failures still use similarity** (L1/L2 shadow entries)
4. **As failures accumulate evidence, they crystallize** — their fibers get pinned, they move to L3, and blocking becomes instant

This means the Shadow Genome has the same thermodynamic lifecycle as regular memory:
- A new failure pattern starts hot (L1, high temperature, similarity-matched)
- As it triggers repeatedly, it cools (fibers pinned, moves to L2)
- After enough evidence, it crystallizes (L3, O(1) blocking, permanent)

**The immune system gets faster the more it learns.** A brand-new threat requires expensive similarity checking. A well-known threat is blocked in constant time via address lookup.

---

## 7. Performance Summary

| Operation | Current | With UOR | Improvement |
|-----------|---------|----------|-------------|
| Memory identity | UUID (random) | BLAKE3 (content) | Meaningful + deduplicated |
| Content hash | SHA-256 | BLAKE3 | ~3-6x faster |
| Decay calculation | `w₀ × e^(-λ × t)` | `w₀ × e^(-λ_base × T_ctx × t)` | Saturation-aware (L3 = no decay) |
| L3 query | O(N) vector scan | O(1) hash lookup | Orders of magnitude |
| Chain verification | SHA-256 chain | BLAKE3 chain + fiber delta | Richer audit trail, faster hash |
| Shadow blocking | O(N) cosine similarity | O(1) for crystallized patterns | Faster with experience |
| Hash operations per write | 3 (content + block + chain) | 2 (address + chain link) | 33% fewer |

---

## 8. Conclusion

Your CMHL decay model and UOR's thermodynamic framework aren't competing — they're the same physics viewed from different angles. CMHL asks "how old is this memory?" UOR asks "how resolved is this memory?" The unified model asks both simultaneously: **a memory's effective decay rate is proportional to its unresolvedness, and resolution is driven by access patterns, cross-references, and verification.**

The cryptographic infrastructure converges too: BLAKE3 content-addressing replaces three separate SHA-256 operations (content hash, block hash, shadow ID) with a single faster primitive that simultaneously provides identity, integrity, and deduplication.

The result is a system where:
- **Hot memories cool naturally** (access → fiber pinning → lower temperature → lower decay)
- **Cool memories are faster to access** (higher saturation → O(1) at L3)
- **The system optimizes itself** (frequency drives crystallization drives performance)
- **The immune system strengthens with experience** (shadow patterns crystallize like memories)
- **The audit trail is thermodynamically complete** (fiber deltas, not just timestamps)

This is the bridge. The compute tax is paid once per memory (BLAKE3 addressing + fiber initialization), and every subsequent access makes the system faster, not slower.

---

*Research complete. The unified model is advisory — architectural decisions remain with the Governor.*
