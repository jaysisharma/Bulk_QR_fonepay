mod engine;
mod splitter;

use engine::{GenerateJob, GenerateResult};
use splitter::{ScanResult, SplitFolderParams, SplitFolderResult};

#[tauri::command]
fn generate_pdf(job: GenerateJob) -> Result<GenerateResult, String> {
    engine::process_pdf_generation(job)
}

#[tauri::command]
fn scan_folder(folder_path: String) -> Result<ScanResult, String> {
    splitter::scan_folder_impl(&folder_path)
}

#[tauri::command]
fn split_folder(params: SplitFolderParams) -> Result<SplitFolderResult, String> {
    splitter::split_folder_impl(params)
}

#[tauri::command]
fn open_folder_in_os(folder_path: String) -> Result<(), String> {
    splitter::open_folder_impl(&folder_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_pdf,
            scan_folder,
            split_folder,
            open_folder_in_os
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

