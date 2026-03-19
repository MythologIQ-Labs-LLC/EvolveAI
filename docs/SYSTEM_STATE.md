# System State

**Generated**: 2026-03-19T00:00:00Z
**Phase**: SUBSTANTIATE
**Status**: SEALED
**Version**: v5.1.0

---

## evolve-core: 40 files, 8 modules, 129 tests

```
crates/evolve-core/src/
├── lib.rs                        # 7 modules
├── representation/               # 8 files, 16 tests
│   ├── types.rs, engine.rs, similarity.rs, mock.rs
│   ├── factory.rs, ggcore.rs
│   └── tests.rs
├── memory/                       # 6 files, 34 tests (v5.1: weighted pinning, entropy injection)
├── chain/                        # 5 files, 12 tests
├── tiers/                        # 6 files, 19 tests
├── shadow/                       # 5 files, 11 tests
├── lifecycle/                    # 4 files, 12 tests
└── processor/                    # 5 files, 25 tests (v5.1: persist extracted, record_access/conflict)
```

## v5.1 Changes: Bidirectional Thermodynamics

| Phase | Description | Key Change |
|-------|-------------|------------|
| 0 | Facade Extraction | Persistence → persist.rs (Section 4 remediation) |
| 1 | Weighted Pinning | PinningEvent enum, pin_weight(), boost_saturation_weighted() |
| 2 | Entropy Injection | inject_entropy(), record_conflict() — reversible crystallization |

## Thermodynamic Primitives

| Function | Purpose | Location |
|----------|---------|----------|
| `temperature(σ)` | T_ctx = (1-σ) × ln(2) | decay.rs |
| `effective_lambda(λ, σ)` | λ_eff = λ_base × T_ctx | decay.rs |
| `calculate_decay(...)` | w = e^(-λ_eff × elapsed) | decay.rs |
| `pin_weight(event)` | Event → fiber pin weight | decay.rs |
| `boost_saturation_weighted(σ, event)` | Cooling: σ increases by event weight | decay.rs |
| `inject_entropy(σ, severity)` | Heating: σ decreases by severity | decay.rs |

## Pinning Hierarchy

| Event | Weight | Effect |
|-------|--------|--------|
| Access | 0.01 | Low — prevents spam crystallization |
| CrossReference | 0.05 | Medium — relational evidence |
| Corroboration | 0.05 | Medium — convergent evidence |
| CryptoVerification | 0.15 | High — structural integrity |

## Section 4 Compliance

| Check | Limit | Actual | Status |
|-------|-------|--------|--------|
| Max production file | 250 | 249 | PASS |
| Max function lines | 40 | 12 | PASS |
| Max nesting depth | 3 | 2 | PASS |
| Console artifacts | 0 | 0 | PASS |

---

*State captured by QoreLogic A.E.G.I.S.*
