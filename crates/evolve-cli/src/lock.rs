//! Advisory file locking around the load→mutate→save cycle.
//!
//! Every command takes a lock on `<state-dir>/memory.lock` for its whole
//! duration: exclusive for commands that write state, shared for read-only
//! commands. Locks are advisory (fd-lock / flock semantics): they coordinate
//! concurrent `evolve-cli` invocations so writes are never silently lost,
//! but do not protect against other programs editing `memory.json` directly.
//!
//! Acquisition is non-blocking first; on contention a "waiting for lock"
//! notice is printed to stderr and the call blocks until the lock frees.

use std::fs::{File, OpenOptions};
use std::io;
use std::path::Path;

/// Lock mode for a command.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    /// Read-only command: shared lock, concurrent readers allowed.
    Shared,
    /// Mutating command: exclusive lock over load→mutate→save.
    Exclusive,
}

/// A held lock guard. Keep it alive for the duration of the command.
#[allow(dead_code)] // The guards are held for their Drop side effect only.
pub enum Guard<'a> {
    Shared(fd_lock::RwLockReadGuard<'a, File>),
    Exclusive(fd_lock::RwLockWriteGuard<'a, File>),
}

/// Open (creating if needed) the lock file and wrap it for locking.
pub fn open(lock_path: &Path) -> io::Result<fd_lock::RwLock<File>> {
    if let Some(parent) = lock_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(lock_path)?;
    Ok(fd_lock::RwLock::new(file))
}

/// Acquire the lock in the given mode, printing a notice to stderr if
/// another invocation currently holds it.
///
/// Implemented as probe-then-acquire: a non-blocking attempt detects
/// contention (so the notice can be printed), then the blocking call takes
/// the lock. The tiny window between probe and acquire can at worst print
/// the notice needlessly or skip it — never corrupt locking semantics.
pub fn acquire(lock: &mut fd_lock::RwLock<File>, mode: Mode) -> io::Result<Guard<'_>> {
    let contended = probe(lock, mode)?;
    if contended {
        eprintln!("waiting for lock (another evolve-cli invocation is running)...");
    }
    match mode {
        Mode::Shared => lock.read().map(Guard::Shared),
        Mode::Exclusive => lock.write().map(Guard::Exclusive),
    }
}

/// Try the lock without holding it. Returns `Ok(true)` when currently held
/// by another invocation, `Ok(false)` when free.
fn probe(lock: &mut fd_lock::RwLock<File>, mode: Mode) -> io::Result<bool> {
    let result = match mode {
        Mode::Shared => lock.try_read().map(drop),
        Mode::Exclusive => lock.try_write().map(drop),
    };
    match result {
        Ok(()) => Ok(false),
        Err(e) if e.kind() == io::ErrorKind::WouldBlock => Ok(true),
        Err(e) => Err(e),
    }
}
