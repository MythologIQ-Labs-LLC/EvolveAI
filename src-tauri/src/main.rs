#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
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
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
