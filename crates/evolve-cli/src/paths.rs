//! State-path resolution.
//!
//! The state directory holds `memory.json` (persisted memory state) and
//! `memory.lock` (advisory lock file). It resolves, in order:
//!
//! 1. `EVOLVE_HOME` — the state directory itself (used by tests and
//!    alternate profiles);
//! 2. `$HOME/.evolve` (or `%USERPROFILE%\.evolve` on Windows);
//! 3. `./.evolve` as a last resort.

use std::path::PathBuf;

/// Pure resolution from environment values (testable without touching the
/// process environment).
pub fn state_dir_from(
    evolve_home: Option<String>,
    home: Option<String>,
    userprofile: Option<String>,
) -> PathBuf {
    if let Some(dir) = evolve_home.filter(|d| !d.is_empty()) {
        return PathBuf::from(dir);
    }
    let base = home
        .filter(|h| !h.is_empty())
        .or_else(|| userprofile.filter(|u| !u.is_empty()))
        .unwrap_or_else(|| ".".into());
    PathBuf::from(base).join(".evolve")
}

/// The state directory for this invocation.
pub fn state_dir() -> PathBuf {
    state_dir_from(
        std::env::var("EVOLVE_HOME").ok(),
        std::env::var("HOME").ok(),
        std::env::var("USERPROFILE").ok(),
    )
}

/// Path of the persisted memory state.
pub fn state_file() -> PathBuf {
    state_dir().join("memory.json")
}

/// Path of the advisory lock file guarding the load→mutate→save cycle.
pub fn lock_file() -> PathBuf {
    state_dir().join("memory.lock")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evolve_home_override_wins() {
        let dir = state_dir_from(
            Some("/tmp/evolve-test".into()),
            Some("/home/someone".into()),
            None,
        );
        assert_eq!(dir, PathBuf::from("/tmp/evolve-test"));
    }

    #[test]
    fn empty_evolve_home_falls_back_to_home() {
        let dir = state_dir_from(Some(String::new()), Some("/home/someone".into()), None);
        assert_eq!(dir, PathBuf::from("/home/someone/.evolve"));
    }

    #[test]
    fn userprofile_used_when_home_absent() {
        let dir = state_dir_from(None, None, Some("C:/Users/someone".into()));
        assert_eq!(dir, PathBuf::from("C:/Users/someone/.evolve"));
    }

    #[test]
    fn falls_back_to_cwd_when_nothing_set() {
        let dir = state_dir_from(None, None, None);
        assert_eq!(dir, PathBuf::from("./.evolve"));
    }
}
