# QoreLogic Repository Release

Execute the QoreLogic A.E.G.I.S. RELEASE phase for this repository.

## Prerequisites

Before executing this skill, verify:
1. The META_LEDGER.md chain status is SEALED (all prior phases complete)
2. All tests pass (`npm test`)
3. Build succeeds (`npm run build`)

## Release Workflow

Execute the following steps in order:

### Step 1: Chain Integrity Verification

Read `docs/META_LEDGER.md` and verify:
- Chain Status is SEALED
- Final hash is documented
- All 5 phases are complete (GENESIS, PLAN, GATE, IMPLEMENT, SUBSTANTIATE)

If not SEALED, report the missing phases and ABORT.

### Step 2: Pre-Release Checks

Run the following checks (all must pass):

```bash
npm test              # All tests must pass
npm run lint          # No lint errors (warnings OK)
npm run build         # Build must succeed
```

Report any failures and ABORT if critical.

### Step 3: Version Determination

Check `package.json` for current version. Determine release version:
- If no prior releases: use version from package.json (e.g., 1.0.0)
- If prior releases exist: suggest semantic version bump

### Step 4: Generate Release Notes

Extract from META_LEDGER.md:
- Summary of each ledger entry
- Key components delivered
- Any deferred components

Format as GitHub-compatible release notes.

### Step 5: Create Release Entry

Append a new entry to `docs/META_LEDGER.md`:

```markdown
### Entry #N: RELEASE

**Timestamp**: [ISO-8601 timestamp]
**Phase**: RELEASE
**Author**: Governor
**Risk Grade**: L3
**Version**: [semantic version]

**Content Hash**:
```
SHA256(src/**) = [computed hash]
SHA256(META_LEDGER.md) = [hash of ledger before this entry]
```

**Previous Hash**: [final chain hash from SUBSTANTIATE]

**Chain Hash**:
```
SHA256(content_hash + previous_hash) = [new chain hash]
```

**Decision**: Release v[version] finalized.

**Release Notes**:
[Generated release notes summary]

**Tag**: v[version]
```

### Step 6: Git Operations

Execute:
1. Stage the updated META_LEDGER.md
2. Commit with message: `chore: release v[version] - QoreLogic RELEASE phase`
3. Create annotated git tag: `git tag -a v[version] -m "Release v[version]"`

### Step 7: Confirmation

Display:
- Release version
- Git tag created
- Chain hash
- Reminder to push with `git push --follow-tags` if ready

## Arguments

- `--dry-run`: Execute all checks but do not modify files or create commits
- `--push`: Automatically push commits and tags to origin after release
- `--version <semver>`: Override automatic version detection

## Output

On success, display a summary table:

| Check | Status |
|-------|--------|
| Chain Integrity | PASS |
| Tests | PASS |
| Build | PASS |
| Version | v1.0.0 |
| Tag | v1.0.0 |
| Chain Hash | [hash] |

## Related Skills

- `/ql-audit` - Gate tribunal audit (must pass before release)
- `/ql-substantiate` - Verify implementation matches design
