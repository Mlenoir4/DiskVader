// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Serialize, Deserialize};
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, Serialize)]
struct ScanProgress {
    files_analyzed: u32,
    total_size: u64,
}

#[derive(Clone, Serialize, Deserialize)]
struct ScanData {
    total_files: u32,
    total_folders: u32,
    total_size: u64,
    free_space: u64,
    used_percentage: f32,
    scan_time: f32,
    scan_path: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct FileItem {
    id: u32,
    name: String,
    path: String,
    size: u64,
    #[serde(rename = "type")]
    file_type: String,
    extension: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct FolderItem {
    id: u32,
    name: String,
    size: u64,
    file_count: u32,
    percentage: f32,
}

#[derive(Clone, Serialize, Deserialize)]
struct FileTypeDistributionItem {
    #[serde(rename = "type")]
    file_type: String,
    size: u64,
    count: u32,
    color: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct PieChartDataItem {
    name: String,
    value: f32,
    color: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct GrowthDataItem {
    name: String,
    value: u32,
}

#[derive(Clone, Serialize, Deserialize)]
struct CleanupSuggestionItem {
    #[serde(rename = "type")]
    cleanup_type: String,
    size: u64,
    count: u32,
    color_class: String,
}

#[tauri::command]
async fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |folder_path| {
        tx.send(folder_path.map(|p| p.to_string()))
            .unwrap();
    });
    Ok(rx.recv().unwrap())
}

#[tauri::command]
async fn start_scan(app: tauri::AppHandle, path: String) -> Result<(), String> {
    println!("Starting scan on: {}", path);
    for i in 1..=100 {
        let progress = ScanProgress {
            files_analyzed: i * 100,
            total_size: i as u64 * 10000000,
        };
        app.emit("scan_progress", progress).map_err(|e| e.to_string())?;
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    }
    Ok(())
}

#[tauri::command]
fn get_scan_results() -> Result<ScanData, String> {
    Ok(ScanData {
        total_files: 12847,
        total_folders: 1234,
        total_size: 247800000000,
        free_space: 52200000000, // ~52 GB libre
        used_percentage: 82.6,
        scan_time: 2.4,
        scan_path: "/Users/username/Documents".to_string(),
    })
}

#[tauri::command]
fn get_largest_files() -> Result<Vec<FileItem>, String> {
    Ok(vec![
        FileItem {
            id: 1,
            name: "presentation_final.mov".to_string(),
            path: "/Videos/Work".to_string(),
            size: 8200000000,
            file_type: "video".to_string(),
            extension: "mov".to_string(),
        },
        FileItem {
            id: 2,
            name: "backup_2025.zip".to_string(),
            path: "/Documents".to_string(),
            size: 5700000000,
            file_type: "archive".to_string(),
            extension: "zip".to_string(),
        },
        FileItem {
            id: 3,
            name: "raw_photos.psd".to_string(),
            path: "/Photos/Projects".to_string(),
            size: 3400000000,
            file_type: "image".to_string(),
            extension: "psd".to_string(),
        },
    ])
}

#[tauri::command]
fn get_folders() -> Result<Vec<FolderItem>, String> {
    Ok(vec![
        FolderItem {
            id: 1,
            name: "Videos".to_string(),
            size: 89200000000,
            file_count: 1567,
            percentage: 85.0,
        },
        FolderItem {
            id: 2,
            name: "Photos".to_string(),
            size: 67400000000,
            file_count: 5621,
            percentage: 67.0,
        },
        FolderItem {
            id: 3,
            name: "Documents".to_string(),
            size: 34700000000,
            file_count: 3754,
            percentage: 34.0,
        },
    ])
}

#[tauri::command]
fn get_file_type_distribution() -> Result<Vec<FileTypeDistributionItem>, String> {
    Ok(vec![
        FileTypeDistributionItem {
            file_type: "Video Files".to_string(),
            size: 89200000000,
            count: 1347,
            color: "#3b82f6".to_string(),
        },
        FileTypeDistributionItem {
            file_type: "Images".to_string(),
            size: 67400000000,
            count: 5471,
            color: "#10b981".to_string(),
        },
        FileTypeDistributionItem {
            file_type: "Documents".to_string(),
            size: 34700000000,
            count: 3754,
            color: "#f59e0b".to_string(),
        },
        FileTypeDistributionItem {
            file_type: "Archives".to_string(),
            size: 28100000000,
            count: 543,
            color: "#8b5cf6".to_string(),
        },
    ])
}

#[tauri::command]
fn get_pie_chart_data() -> Result<Vec<PieChartDataItem>, String> {
    Ok(vec![
        PieChartDataItem { name: "Videos".to_string(), value: 487.3, color: "#3b82f6".to_string() },
        PieChartDataItem { name: "Images".to_string(), value: 201.8, color: "#10b981".to_string() },
        PieChartDataItem { name: "Documents".to_string(), value: 158.1, color: "#f59e0b".to_string() },
    ])
}

#[tauri::command]
fn get_doughnut_data() -> Result<Vec<PieChartDataItem>, String> {
    Ok(vec![
        PieChartDataItem { name: "Videos".to_string(), value: 487.3, color: "#3b82f6".to_string() },
        PieChartDataItem { name: "Images".to_string(), value: 201.8, color: "#10b981".to_string() },
        PieChartDataItem { name: "Documents".to_string(), value: 158.1, color: "#f59e0b".to_string() },
        PieChartDataItem { name: "Other".to_string(), value: 95.2, color: "#6b7280".to_string() },
    ])
}

#[tauri::command]
fn get_trend_data(period: Option<String>) -> Result<Vec<GrowthDataItem>, String> {
    let period = period.unwrap_or_else(|| "30D".to_string());
    
    match period.as_str() {
        "7D" => Ok(vec![
            GrowthDataItem { name: "Mon".to_string(), value: 483 },
            GrowthDataItem { name: "Tue".to_string(), value: 484 },
            GrowthDataItem { name: "Wed".to_string(), value: 485 },
            GrowthDataItem { name: "Thu".to_string(), value: 486 },
            GrowthDataItem { name: "Fri".to_string(), value: 487 },
            GrowthDataItem { name: "Sat".to_string(), value: 487 },
            GrowthDataItem { name: "Sun".to_string(), value: 487 },
        ]),
        "30D" => Ok(vec![
            GrowthDataItem { name: "Week 1".to_string(), value: 478 },
            GrowthDataItem { name: "Week 2".to_string(), value: 481 },
            GrowthDataItem { name: "Week 3".to_string(), value: 484 },
            GrowthDataItem { name: "Week 4".to_string(), value: 487 },
        ]),
        "90D" => Ok(vec![
            GrowthDataItem { name: "Jan".to_string(), value: 465 },
            GrowthDataItem { name: "Feb".to_string(), value: 471 },
            GrowthDataItem { name: "Mar".to_string(), value: 487 },
        ]),
        _ => Ok(vec![
            GrowthDataItem { name: "Week 1".to_string(), value: 478 },
            GrowthDataItem { name: "Week 2".to_string(), value: 481 },
            GrowthDataItem { name: "Week 3".to_string(), value: 484 },
            GrowthDataItem { name: "Week 4".to_string(), value: 487 },
        ])
    }
}

#[tauri::command]
fn get_growth_data() -> Result<Vec<GrowthDataItem>, String> {
    Ok(vec![
        GrowthDataItem { name: "Jan 2025".to_string(), value: 650 },
        GrowthDataItem { name: "Feb 2025".to_string(), value: 720 },
        GrowthDataItem { name: "Mar 2025".to_string(), value: 780 },
        GrowthDataItem { name: "Apr 2025".to_string(), value: 825 },
        GrowthDataItem { name: "May 2025".to_string(), value: 840 },
        GrowthDataItem { name: "Jun 2025".to_string(), value: 847 },
    ])
}

#[tauri::command]
fn get_cleanup_suggestions() -> Result<Vec<CleanupSuggestionItem>, String> {
    Ok(vec![
        CleanupSuggestionItem { 
            cleanup_type: "Duplicate Files".to_string(), 
            size: 2100000000, 
            count: 67, 
            color_class: "blue".to_string() 
        },
        CleanupSuggestionItem { 
            cleanup_type: "Old Backups".to_string(), 
            size: 1200000000, 
            count: 6, 
            color_class: "green".to_string() 
        },
        CleanupSuggestionItem { 
            cleanup_type: "Empty Folders".to_string(), 
            size: 0, 
            count: 23, 
            color_class: "yellow".to_string() 
        },
    ])
}

#[tauri::command]
fn export_report() -> Result<(), String> {
    println!("Exporting report...");
    // Placeholder for export functionality
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            select_folder,
            start_scan,
            get_scan_results,
            get_largest_files,
            get_folders,
            get_file_type_distribution,
            get_pie_chart_data,
            get_doughnut_data,
            get_trend_data,
            get_growth_data,
            get_cleanup_suggestions,
            export_report,
        ])
        .run(tauri::generate_context!()) 
        .expect("error while running tauri application");
}
