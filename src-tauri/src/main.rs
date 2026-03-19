#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod commands_v2;
mod state;

fn main() {
    tauri::Builder::default()
        .manage(state::create_processor())
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
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
