# System State

**Generated**: 2026-03-19T02:15:00Z
**Phase**: SUBSTANTIATE
**Status**: SEALED
**Version**: v5.3.0

---

## evolve-core: 42 files, 9 modules, 150 tests

```
crates/evolve-core/src/
├── lib.rs                        # 8 modules
├── simple.rs                     # v5.3: SimpleMemory ergonomic facade (BL-014)
├── representation/               # 8 files, 16 tests
├── memory/                       # 6 files, 36 tests
├── chain/                        # 5 files, 12 tests
├── tiers/                        # 6 files, 22 tests
├── shadow/                       # 5 files, 11 tests
├── lifecycle/                    # 4 files, 12 tests
└── processor/                    # 6 files, 32 tests
    ├── facade.rs                 # Core processor (212 lines)
    ├── query.rs                  # Query extraction (102 lines)
    ├── persist.rs                # Persistence extraction (69 lines)
    └── types.rs                  # Shared types + config (99 lines)
```

## SimpleMemory API (v5.3)

```rust
let mut mem = SimpleMemory::new();
let addr = mem.add("the sky is blue").await?;
let results = mem.search("sky color", 5).await?;
mem.feedback(&addr, PinningEvent::CryptoVerification);
```

| Method | Delegates To |
|--------|-------------|
| `add(content)` | processor.encode() |
| `add_tagged(content, tags)` | processor.encode() |
| `search(query, top_k)` | processor.query() |
| `feedback(addr, event)` | processor.record_access() |
| `dispute(addr, severity)` | processor.record_conflict() |
| `end_session()` | processor.clear_session() |
| `into_processor()` | Escape hatch to full API |

## Section 4 Compliance

| Check | Limit | Actual | Status |
|-------|-------|--------|--------|
| Max production file | 250 | 212 (facade.rs) | PASS |
| Max function lines | 40 | 15 (add_tagged) | PASS |
| Max nesting depth | 3 | 2 | PASS |
| Console artifacts | 0 | 0 | PASS |

---

*State captured by QoreLogic A.E.G.I.S.*
