// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod scan_handler;
mod file_operations_handler;

use std::sync::{Arc, Mutex};

use models::SharedScanResults;

fn main() {
    let scan_results: SharedScanResults = Arc::new(Mutex::new(models::ScanResults::default()));
    
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(scan_results)
        .invoke_handler(tauri::generate_handler![
            scan_handler::select_folder,
            scan_handler::start_scan,
            scan_handler::cancel_scan,
            scan_handler::get_scan_results,
            scan_handler::get_largest_files,
            scan_handler::get_folders,
            scan_handler::get_all_folders,
            scan_handler::get_folder_files,
            scan_handler::get_file_type_distribution,
            scan_handler::get_pie_chart_data,
            scan_handler::get_doughnut_data,
            scan_handler::get_trend_data,
            scan_handler::get_growth_data,
            scan_handler::get_error_logs,
            scan_handler::get_error_data,
            scan_handler::clear_error_logs,
            scan_handler::has_scan_error,
            scan_handler::simulate_scan_error,
            file_operations_handler::get_cleanup_suggestions,
            file_operations_handler::get_trash_info,
            file_operations_handler::empty_trash,
            file_operations_handler::delete_file,
            file_operations_handler::compress_files,
            file_operations_handler::move_to_cloud,
            file_operations_handler::clean_selected_items,
            file_operations_handler::export_report,
        ])
        .run(tauri::generate_context!()) 
        .expect("error while running tauri application");
}