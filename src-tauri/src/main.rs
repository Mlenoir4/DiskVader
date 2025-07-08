// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Serialize, Deserialize};
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::State;

#[derive(Clone, Serialize)]
struct ScanProgress {
    #[serde(rename = "filesAnalyzed")]
    files_analyzed: u32,
    #[serde(rename = "totalSize")]
    total_size: u64,
    #[serde(rename = "currentPath")]
    current_path: String,
    progress: f32,
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
    path: String,
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

#[derive(Clone, Debug)]
struct ScannedFile {
    name: String,
    path: PathBuf,
    size: u64,
    file_type: String,
    extension: String,
}

#[derive(Clone, Debug)]
struct ScannedFolder {
    name: String,
    path: PathBuf,
    size: u64,
    file_count: u32,
}

#[derive(Clone, Debug, Default)]
struct ScanResults {
    total_files: u32,
    total_folders: u32,
    total_size: u64,
    scan_time: f32,
    scan_path: String,
    largest_files: Vec<ScannedFile>,
    folders: Vec<ScannedFolder>, // Top 10 folders for compatibility
    all_folders: Vec<ScannedFolder>, // All folders scanned
    file_type_distribution: HashMap<String, (u64, u32)>, // (size, count)
}

type SharedScanResults = Arc<Mutex<ScanResults>>;

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
async fn start_scan(app: tauri::AppHandle, path: String, scan_results: State<'_, SharedScanResults>) -> Result<(), String> {
    println!("Starting real scan on: {}", path);
    
    let scan_path = Path::new(&path);
    if !scan_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    
    if !scan_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    
    // Reset scan results
    {
        let mut results = scan_results.lock().unwrap();
        *results = ScanResults::default();
        results.scan_path = path.clone();
    }
    
    let start_time = Instant::now();
    let mut files_analyzed = 0u32;
    let mut total_size = 0u64;
    let mut folder_count = 0u32;
    let mut largest_files = Vec::new();
    let mut folder_sizes: HashMap<PathBuf, (u64, u32)> = HashMap::new();
    let mut file_type_distribution: HashMap<String, (u64, u32)> = HashMap::new();
    
    match scan_directory_recursive(
        &app, 
        scan_path, 
        &mut files_analyzed, 
        &mut total_size, 
        &mut folder_count,
        &mut largest_files,
        &mut folder_sizes,
        &mut file_type_distribution
    ).await {
        Ok(_) => {
            let elapsed = start_time.elapsed().as_secs_f32();
            println!("Scan completed in {:.2} seconds", elapsed);
            println!("Total files analyzed: {}", files_analyzed);
            println!("Total size: {} bytes", total_size);
            
            // Store results
            {
                let mut results = scan_results.lock().unwrap();
                results.total_files = files_analyzed;
                results.total_folders = folder_count;
                results.total_size = total_size;
                results.scan_time = elapsed;
                
                // Keep only top 20 largest files
                largest_files.sort_by(|a, b| b.size.cmp(&a.size));
                largest_files.truncate(20);
                results.largest_files = largest_files;
                
                // Convert folder sizes to ScannedFolder
                let mut all_folders: Vec<_> = folder_sizes.into_iter()
                    .map(|(path, (size, count))| ScannedFolder {
                        name: path.file_name().unwrap_or_else(|| path.as_os_str()).to_string_lossy().to_string(),
                        path,
                        size,
                        file_count: count,
                    })
                    .filter(|folder| folder.size > 0 && folder.file_count > 0) // Filtrer les dossiers vides
                    .collect();
                all_folders.sort_by(|a, b| b.size.cmp(&a.size));
                
                // Store all folders
                results.all_folders = all_folders.clone();
                
                // Keep only top 10 for compatibility with existing frontend
                all_folders.truncate(10);
                results.folders = all_folders;
                
                results.file_type_distribution = file_type_distribution;
            }
            
            Ok(())
        }
        Err(e) => Err(format!("Scan failed: {}", e))
    }
}

async fn scan_directory_recursive(
    app: &tauri::AppHandle,
    dir_path: &Path,
    files_analyzed: &mut u32,
    total_size: &mut u64,
    folder_count: &mut u32,
    largest_files: &mut Vec<ScannedFile>,
    folder_sizes: &mut HashMap<PathBuf, (u64, u32)>,
    file_type_distribution: &mut HashMap<String, (u64, u32)>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let entries = match fs::read_dir(dir_path) {
        Ok(entries) => entries,
        Err(e) => {
            println!("Warning: Cannot read directory {:?}: {}", dir_path, e);
            return Ok(()); // Continue scanning other directories
        }
    };
    
    *folder_count += 1;
    let mut current_folder_size = 0u64;
    let mut current_folder_files = 0u32;
    
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(e) => {
                println!("Warning: Cannot read entry: {}", e);
                continue;
            }
        };
        
        let entry_path = entry.path();
        let current_path_str = entry_path.to_string_lossy().to_string();
        
        if entry_path.is_file() {
            match entry.metadata() {
                Ok(metadata) => {
                    let file_size = metadata.len();
                    *files_analyzed += 1;
                    *total_size += file_size;
                    current_folder_size += file_size;
                    current_folder_files += 1;
                    
                    // Get file extension and type
                    let extension = entry_path.extension()
                        .and_then(|ext| ext.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    
                    let file_type = get_file_type(&extension);
                    
                    // Update file type distribution
                    let counter = file_type_distribution.entry(file_type.clone()).or_insert((0, 0));
                    counter.0 += file_size;
                    counter.1 += 1;
                    
                    // Add to largest files if significant
                    if file_size > 10_000 { // Files larger than 10KB
                        largest_files.push(ScannedFile {
                            name: entry_path.file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string(),
                            path: entry_path.clone(),
                            size: file_size,
                            file_type,
                            extension,
                        });
                    }
                    
                    // Emit progress every 100 files to avoid overwhelming the frontend
                    if *files_analyzed % 100 == 0 {
                        let progress = ScanProgress {
                            files_analyzed: *files_analyzed,
                            total_size: *total_size,
                            current_path: current_path_str.clone(),
                            progress: 0.0, // We don't know total beforehand for real scanning
                        };
                        
                        if let Err(e) = app.emit("scan_progress", progress) {
                            println!("Warning: Failed to emit progress: {}", e);
                        }
                    }
                }
                Err(e) => {
                    println!("Warning: Cannot get metadata for file {:?}: {}", entry_path, e);
                }
            }
        } else if entry_path.is_dir() {
            // Emit progress for directory scanning
            let progress = ScanProgress {
                files_analyzed: *files_analyzed,
                total_size: *total_size,
                current_path: current_path_str.clone(),
                progress: 0.0,
            };
            
            if let Err(e) = app.emit("scan_progress", progress) {
                println!("Warning: Failed to emit progress: {}", e);
            }
            
            // Recursively scan subdirectory
            Box::pin(scan_directory_recursive(
                app, 
                &entry_path, 
                files_analyzed, 
                total_size, 
                folder_count,
                largest_files,
                folder_sizes,
                file_type_distribution
            )).await?;
        }
        
        // Small delay to prevent overwhelming the system and allow UI updates
        tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
    }
    
    // Store folder size information
    folder_sizes.insert(dir_path.to_path_buf(), (current_folder_size, current_folder_files));
    
    Ok(())
}

fn get_file_type(extension: &str) -> String {
    match extension {
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" => "Video Files".to_string(),
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "tiff" | "svg" | "webp" | "raw" | "psd" => "Images".to_string(),
        "pdf" | "doc" | "docx" | "txt" | "rtf" | "odt" | "pages" => "Documents".to_string(),
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => "Archives".to_string(),
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "wma" => "Audio Files".to_string(),
        "exe" | "app" | "deb" | "rpm" | "dmg" | "msi" => "Applications".to_string(),
        _ => "Other".to_string(),
    }
}

#[tauri::command]
fn get_scan_results(scan_results: State<'_, SharedScanResults>) -> Result<ScanData, String> {
    let results = scan_results.lock().unwrap();
    
    // Get disk space info (this would ideally use a proper disk space library)
    let free_space = 52200000000u64; // Placeholder - would need proper disk space detection
    let used_percentage = if results.total_size > 0 {
        (results.total_size as f32 / (results.total_size + free_space) as f32) * 100.0
    } else {
        0.0
    };
    
    Ok(ScanData {
        total_files: results.total_files,
        total_folders: results.total_folders,
        total_size: results.total_size,
        free_space,
        used_percentage,
        scan_time: results.scan_time,
        scan_path: results.scan_path.clone(),
    })
}

#[tauri::command]
fn get_largest_files(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FileItem>, String> {
    let results = scan_results.lock().unwrap();
    
    let mut file_items: Vec<FileItem> = results.largest_files.iter()
        .enumerate()
        .map(|(index, file)| FileItem {
            id: index as u32 + 1,
            name: file.name.clone(),
            path: file.path.parent()
                .unwrap_or_else(|| Path::new(""))
                .to_string_lossy()
                .to_string(),
            size: file.size,
            file_type: file.file_type.clone(),
            extension: file.extension.clone(),
        })
        .collect();
    
    file_items.truncate(20); // Limit to top 20
    Ok(file_items)
}

#[tauri::command]
fn get_folders(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FolderItem>, String> {
    let results = scan_results.lock().unwrap();
    let total_size = results.total_size as f32;
    
    let folder_items: Vec<FolderItem> = results.folders.iter()
        .enumerate()
        .map(|(index, folder)| FolderItem {
            id: index as u32 + 1,
            name: folder.name.clone(),
            path: folder.path.to_string_lossy().to_string(),
            size: folder.size,
            file_count: folder.file_count,
            percentage: if total_size > 0.0 {
                (folder.size as f32 / total_size) * 100.0
            } else {
                0.0
            },
        })
        .collect();
    
    Ok(folder_items)
}

#[tauri::command]
fn get_all_folders(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FolderItem>, String> {
    let results = scan_results.lock().unwrap();
    let total_size = results.total_size as f32;
    
    let folder_items: Vec<FolderItem> = results.all_folders.iter()
        .enumerate()
        .map(|(index, folder)| FolderItem {
            id: index as u32 + 1,
            name: folder.name.clone(),
            path: folder.path.to_string_lossy().to_string(),
            size: folder.size,
            file_count: folder.file_count,
            percentage: if total_size > 0.0 {
                (folder.size as f32 / total_size) * 100.0
            } else {
                0.0
            },
        })
        .collect();
    
    Ok(folder_items)
}

#[tauri::command]
fn get_folder_files(folder_path: String) -> Result<Vec<FileItem>, String> {
    use std::fs;
    
    // Lire directement le contenu du dossier
    let entries = fs::read_dir(&folder_path)
        .map_err(|e| format!("Cannot read directory {}: {}", folder_path, e))?;
    
    let mut files = Vec::new();
    let mut id = 1;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading directory entry: {}", e))?;
        let path = entry.path();
        
        // Filtrer seulement les fichiers (pas les dossiers)
        if path.is_file() {
            let metadata = entry.metadata()
                .map_err(|e| format!("Cannot get metadata for file: {}", e))?;
            
            let file_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();
            
            let file_extension = path.extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("")
                .to_string();
            
            let file_type = if file_extension.is_empty() {
                "Unknown".to_string()
            } else {
                file_extension.to_uppercase()
            };
            
            files.push(FileItem {
                id,
                name: file_name,
                path: path.to_string_lossy().to_string(),
                size: metadata.len(),
                file_type,
                extension: file_extension,
            });
            
            id += 1;
        }
    }
    
    // Trier par taille décroissante
    files.sort_by(|a, b| b.size.cmp(&a.size));
    
    Ok(files)
}

#[tauri::command]
fn get_file_type_distribution(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FileTypeDistributionItem>, String> {
    let results = scan_results.lock().unwrap();
    
    let colors = [
        "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
        "#ef4444", "#06b6d4", "#84cc16", "#f97316"
    ];
    
    let mut distribution: Vec<FileTypeDistributionItem> = results.file_type_distribution.iter()
        .enumerate()
        .map(|(index, (file_type, (size, count)))| FileTypeDistributionItem {
            file_type: file_type.clone(),
            size: *size,
            count: *count,
            color: colors[index % colors.len()].to_string(),
        })
        .collect();
    
    // Sort by size descending
    distribution.sort_by(|a, b| b.size.cmp(&a.size));
    
    Ok(distribution)
}

#[tauri::command]
fn get_pie_chart_data(scan_results: State<'_, SharedScanResults>) -> Result<Vec<PieChartDataItem>, String> {
    let results = scan_results.lock().unwrap();
    
    let colors = [
        "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
        "#ef4444", "#06b6d4", "#84cc16", "#f97316"
    ];
    
    let mut chart_data: Vec<PieChartDataItem> = results.file_type_distribution.iter()
        .enumerate()
        .map(|(index, (file_type, (size, _)))| PieChartDataItem {
            name: file_type.clone(),
            value: *size as f32 / 1_000_000_000.0, // Convert to GB
            color: colors[index % colors.len()].to_string(),
        })
        .filter(|item| item.value > 0.0)
        .collect();
    
    // Sort by value descending and take top items
    chart_data.sort_by(|a, b| b.value.partial_cmp(&a.value).unwrap());
    chart_data.truncate(6);
    
    Ok(chart_data)
}

#[tauri::command]
fn get_doughnut_data(scan_results: State<'_, SharedScanResults>) -> Result<Vec<PieChartDataItem>, String> {
    let results = scan_results.lock().unwrap();
    
    let colors = [
        "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
        "#ef4444", "#06b6d4", "#84cc16", "#f97316"
    ];
    
    let mut chart_data: Vec<PieChartDataItem> = results.file_type_distribution.iter()
        .enumerate()
        .map(|(index, (file_type, (size, _)))| PieChartDataItem {
            name: file_type.clone(),
            value: *size as f32 / 1_000_000_000.0, // Convert to GB
            color: colors[index % colors.len()].to_string(),
        })
        .filter(|item| item.value > 0.0)
        .collect();
    
    // Sort by value descending
    chart_data.sort_by(|a, b| b.value.partial_cmp(&a.value).unwrap());
    
    // Take top 3 and group the rest as "Other"
    if chart_data.len() > 3 {
        let others_value: f32 = chart_data[3..].iter().map(|item| item.value).sum();
        chart_data.truncate(3);
        if others_value > 0.0 {
            chart_data.push(PieChartDataItem {
                name: "Other".to_string(),
                value: others_value,
                color: "#6b7280".to_string(),
            });
        }
    }
    
    Ok(chart_data)
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
    let scan_results: SharedScanResults = Arc::new(Mutex::new(ScanResults::default()));
    
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(scan_results)
        .invoke_handler(tauri::generate_handler![
            select_folder,
            start_scan,
            get_scan_results,
            get_largest_files,
            get_folders,
            get_all_folders,
            get_folder_files,
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
