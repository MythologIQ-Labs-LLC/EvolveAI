#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod commands_v2;
mod persistence;
mod state;

use tauri::Manager;
use tokio::sync::Mutex;

fn main() {
    let app = tauri::Builder::default()
        .manage(state::create_processor())
        .setup(|app| {
            // Load persisted state (if any) before the UI can issue commands.
            // Setup runs on the main thread, outside the tokio runtime, so
            // block_on is safe here.
            {
                let processor = app.state::<Mutex<state::AppProcessor>>();
                tauri::async_runtime::block_on(persistence::load_default(&processor));
            }
            // Start the debounced autosave task (fed by persistence::mark_dirty).
            persistence::spawn_autosave(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::encode_memory,
            commands::query_memory,
            commands::get_stats,
            commands::check_safety,
            commands::health_check,
            commands::save_state,
            commands::load_state,
            commands_v2::feedback,
            commands_v2::dispute,
            commands_v2::approve_crystallization,
            commands_v2::forget_memory,
            commands_v2::get_profile,
            commands_v2::get_slo_report,
            commands_v2::get_related,
            commands_v2::get_pending,
        ])
        .build(tauri::generate_context!())
        .expect("error building tauri application");

    app.run(|app_handle, event| match event {
        // Final save on shutdown. Both events are handled defensively; the
        // save is atomic (tmp-then-rename) so a repeat is harmless. The event
        // loop callback runs on the main thread, outside the tokio runtime,
        // so block_on is safe (blocking_lock would also work here, but panics
        // if ever moved inside a runtime thread — block_on does not have that
        // failure mode on this thread).
        tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
            let processor = app_handle.state::<Mutex<state::AppProcessor>>();
            tauri::async_runtime::block_on(persistence::save_default(&processor));
        }
        _ => {}
    });
}
