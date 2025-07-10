use tauri::State;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::{CommandError, CleanupSuggestionItem, ScannedFile, SharedScanResults};

#[tauri::command]
pub fn get_cleanup_suggestions(scan_results: State<'_, SharedScanResults>) -> Result<Vec<CleanupSuggestionItem>, CommandError> {
    let results = scan_results.lock().unwrap();
    let mut suggestions = Vec::new();
    
    let mut size_groups: HashMap<u64, Vec<&ScannedFile>> = HashMap::new();
    for file in &results.largest_files {
        size_groups.entry(file.size).or_insert_with(Vec::new).push(file);
    }
    
    let mut duplicate_size = 0u64;
    let mut duplicate_count = 0u32;
    for (size, files) in size_groups {
        if files.len() > 1 && size > 10_000 { 
            duplicate_size += size * (files.len() as u64 - 1); 
            duplicate_count += files.len() as u32 - 1;
        }
    }
    
    if duplicate_count > 0 {
        suggestions.push(CleanupSuggestionItem {
            cleanup_type: "Potential Duplicate Files".to_string(),
            size: duplicate_size,
            count: duplicate_count,
            color_class: "blue".to_string(),
        });
    }
    
    let mut backup_size = 0u64;
    let mut backup_count = 0u32;
    for file in &results.largest_files {
        let name_lower = file.name.to_lowercase();
        if name_lower.contains("backup") || name_lower.contains("bak") || 
           name_lower.contains("~") || name_lower.ends_with(".old") ||
           name_lower.contains("copy") || name_lower.contains("temp") {
            backup_size += file.size;
            backup_count += 1;
        }
    }
    
    if backup_count > 0 {
        suggestions.push(CleanupSuggestionItem {
            cleanup_type: "Backup Files".to_string(),
            size: backup_size,
            count: backup_count,
            color_class: "green".to_string(),
        });
    }
    
    let mut empty_folders = 0u32;
    for folder in &results.all_folders {
        if folder.file_count == 0 {
            empty_folders += 1;
        }
    }
    
    if empty_folders > 0 {
        suggestions.push(CleanupSuggestionItem {
            cleanup_type: "Empty Folders".to_string(),
            size: 0,
            count: empty_folders,
            color_class: "yellow".to_string(),
        });
    }
    
    let mut old_large_files_size = 0u64;
    let mut old_large_files_count = 0u32;
    let now = SystemTime::now();
    
    for file in &results.largest_files {
        if file.size > 100_000_000 { 
            if let Ok(metadata) = fs::metadata(&file.path) {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(duration) = now.duration_since(modified) {
                        if duration.as_secs() > 365 * 24 * 3600 { 
                            old_large_files_size += file.size;
                            old_large_files_count += 1;
                        }
                    }
                }
            }
        }
    }
    
    if old_large_files_count > 0 {
        suggestions.push(CleanupSuggestionItem {
            cleanup_type: "Old Large Files (>1 year)".to_string(),
            size: old_large_files_size,
            count: old_large_files_count,
            color_class: "red".to_string(),
        });
    }
    
    let mut temp_size = 0u64;
    let mut temp_count = 0u32;
    for file in &results.largest_files {
        let name_lower = file.name.to_lowercase();
        let path_lower = file.path.to_string_lossy().to_lowercase();
        if name_lower.starts_with("tmp") || name_lower.starts_with("temp") ||
           path_lower.contains("/tmp/") || path_lower.contains("/temp/") ||
           path_lower.contains("\\tmp\\") || path_lower.contains("\\temp\\") ||
           file.extension == "tmp" || file.extension == "temp" {
            temp_size += file.size;
            temp_count += 1;
        }
    }
    
    if temp_count > 0 {
        suggestions.push(CleanupSuggestionItem {
            cleanup_type: "Temporary Files".to_string(),
            size: temp_size,
            count: temp_count,
            color_class: "orange".to_string(),
        });
    }
    
    suggestions.sort_by(|a, b| b.size.cmp(&a.size));
    
    Ok(suggestions)
}

#[tauri::command]
pub fn export_report(scan_results: State<'_, SharedScanResults>) -> Result<(), CommandError> {
    let results = scan_results.lock().unwrap();
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let report_filename = format!("disk_analysis_report_{}.txt", timestamp);
    
    let mut report_content = String::new();
    report_content.push_str("=== DISK ANALYSIS REPORT ===\n\n");
    
    report_content.push_str(&format!("Scan Path: {}\n", results.scan_path));
    report_content.push_str(&format!("Scan Date: {}\n", 
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()));
    report_content.push_str(&format!("Scan Duration: {:.2} seconds\n", results.scan_time));
    report_content.push_str(&format!("Total Files: {}\n", results.total_files));
    report_content.push_str(&format!("Total Folders: {}\n", results.total_folders));
    report_content.push_str(&format!("Total Size: {:.2} GB\n\n", results.total_size as f64 / 1_000_000_000.0));
    
    report_content.push_str("=== TOP 10 LARGEST FILES ===\n");
    for (index, file) in results.largest_files.iter().take(10).enumerate() {
        report_content.push_str(&format!("{}. {} - {:.2} MB ({})\n", 
            index + 1, 
            file.name, 
            file.size as f64 / 1_000_000.0,
            file.path.to_string_lossy()));
    }
    report_content.push_str("\n");
    
    report_content.push_str("=== TOP 10 LARGEST FOLDERS ===\n");
    for (index, folder) in results.folders.iter().take(10).enumerate() {
        report_content.push_str(&format!("{}. {} - {:.2} GB ({} files)\n", 
            index + 1, 
            folder.name, 
            folder.size as f64 / 1_000_000_000.0,
            folder.file_count));
    }
    report_content.push_str("\n");
    
    report_content.push_str("=== FILE TYPE DISTRIBUTION ===\n");
    let mut file_types: Vec<_> = results.file_type_distribution.iter().collect();
    file_types.sort_by(|a, b| b.1.0.cmp(&a.1.0)); 
    
    for (file_type, (size, count)) in file_types {
        report_content.push_str(&format!("{}: {:.2} GB ({} files)\n", 
            file_type, 
            *size as f64 / 1_000_000_000.0, 
            count));
    }
    
    match fs::write(&report_filename, report_content) {
        Ok(()) => {
            println!("Report exported to: {}", report_filename);
            Ok(())
        }
        Err(e) => {
            println!("Failed to export report: {}", e);
            Err(CommandError::InternalError(format!("Failed to export report: {}", e)))
        }
    }
}

#[tauri::command]
pub fn get_trash_info() -> Result<crate::models::TrashInfo, CommandError> {
    let mut total_size = 0u64;
    let mut total_count = 0u32;
    
    // Chemins de corbeille selon le système d'exploitation
    let trash_paths = if cfg!(target_os = "macos") {
        vec![
            PathBuf::from(format!("{}/.Trash", std::env::var("HOME").unwrap_or_default())),
        ]
    } else if cfg!(target_os = "linux") {
        vec![
            PathBuf::from(format!("{}/.local/share/Trash/files", std::env::var("HOME").unwrap_or_default())),
        ]
    } else if cfg!(target_os = "windows") {
        // Sur Windows, c'est plus complexe car la corbeille est gérée par le système
        // Pour l'instant, on retourne des données vides
        vec![]
    } else {
        vec![]
    };
    
    for trash_path in trash_paths {
        if trash_path.exists() {
            if let Ok(entries) = fs::read_dir(&trash_path) {
                for entry in entries.flatten() {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_file() {
                            total_size += metadata.len();
                            total_count += 1;
                        } else if metadata.is_dir() {
                            // Calculer récursivement la taille du dossier
                            if let Ok((dir_size, dir_count)) = calculate_directory_size(&entry.path()) {
                                total_size += dir_size;
                                total_count += dir_count;
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(crate::models::TrashInfo {
        size: total_size,
        count: total_count,
    })
}

// Fonction auxiliaire pour calculer la taille d'un dossier
fn calculate_directory_size(path: &Path) -> Result<(u64, u32), std::io::Error> {
    let mut total_size = 0u64;
    let mut file_count = 0u32;
    
    if path.is_dir() {
        let entries = fs::read_dir(path)?;
        for entry in entries {
            let entry = entry?;
            let metadata = entry.metadata()?;
            
            if metadata.is_file() {
                total_size += metadata.len();
                file_count += 1;
            } else if metadata.is_dir() {
                let (sub_size, sub_count) = calculate_directory_size(&entry.path())?;
                total_size += sub_size;
                file_count += sub_count;
            }
        }
    }
    
    Ok((total_size, file_count))
}

#[tauri::command]
pub fn empty_trash() -> Result<(), CommandError> {
    let trash_paths = if cfg!(target_os = "macos") {
        vec![
            PathBuf::from(format!("{}/.Trash", std::env::var("HOME").unwrap_or_default())),
        ]
    } else if cfg!(target_os = "linux") {
        vec![
            PathBuf::from(format!("{}/.local/share/Trash/files", std::env::var("HOME").unwrap_or_default())),
            PathBuf::from(format!("{}/.local/share/Trash/info", std::env::var("HOME").unwrap_or_default())),
        ]
    } else if cfg!(target_os = "windows") {
        // Sur Windows, c'est plus complexe car la corbeille est gérée par le système
        // Pour l'instant, on retourne des données vides
        return Err(CommandError::InternalError("Empty trash not implemented for Windows".to_string()));
    } else {
        vec![]
    };
    
    for trash_path in trash_paths {
        if trash_path.exists() {
            if let Ok(entries) = fs::read_dir(&trash_path) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if entry_path.is_file() {
                        if let Err(e) = fs::remove_file(&entry_path) {
                            println!("Warning: Failed to remove file {:?}, {}", entry_path, e);
                        }
                    } else if entry_path.is_dir() {
                        if let Err(e) = fs::remove_dir_all(&entry_path) {
                            println!("Warning: Failed to remove directory {:?}, {}", entry_path, e);
                        }
                    }
                }
            }
        }
    }
    
    println!("Trash emptied successfully");
    Ok(())
}

#[tauri::command]
pub fn delete_file(file_id: u32, scan_results: State<'_, SharedScanResults>) -> Result<(), CommandError> {
    let results = scan_results.lock().unwrap();
    
    if let Some(file) = results.largest_files.get((file_id - 1) as usize) {
        let file_path = &file.path;
        
        if !file_path.exists() {
            return Err(CommandError::PathDoesNotExist(file_path.to_string_lossy().to_string()));
        }
        
        match trash::delete(file_path) {
            Ok(()) => {
                println!("Successfully moved file to trash: {:?}", file_path);
                Ok(())
            }
            Err(e) => {
                println!("Failed to move file to trash {:?}: {}", file_path, e);
                Err(CommandError::InternalError(format!("Failed to move file to trash: {}", e)))
            }
        }
    } else {
        Err(CommandError::InternalError(format!("File with ID {} not found", file_id)))
    }
}

#[tauri::command]
pub fn compress_files(file_ids: Vec<u32>, scan_results: State<'_, SharedScanResults>) -> Result<(), CommandError> {
    let results = scan_results.lock().unwrap();
    
    let mut files_to_compress = Vec::new();
    for file_id in file_ids {
        if let Some(file) = results.largest_files.get((file_id - 1) as usize) {
            if file.path.exists() {
                files_to_compress.push(&file.path);
            }
        }
    }
    
    if files_to_compress.is_empty() {
        return Err(CommandError::InternalError("No valid files found to compress".to_string()));
    }
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let archive_name = format!("compressed_files_{}.zip", timestamp);
    
    println!("Would compress {} files into {}", files_to_compress.len(), archive_name);
    for file_path in files_to_compress {
        println!("  - {:?}", file_path);
    }
    
    println!("Compression completed (simulated)");
    Ok(())
}

#[tauri::command]
pub fn move_to_cloud(file_ids: Vec<u32>, scan_results: State<'_, SharedScanResults>) -> Result<(), CommandError> {
    let results = scan_results.lock().unwrap();
    
    let mut files_to_move = Vec::new();
    let mut total_size = 0u64;
    
    for file_id in file_ids {
        if let Some(file) = results.largest_files.get((file_id - 1) as usize) {
            if file.path.exists() {
                files_to_move.push((file.path.clone(), file.size));
                total_size += file.size;
            }
        }
    }
    
    if files_to_move.is_empty() {
        return Err(CommandError::InternalError("No valid files found to move".to_string()));
    }
    
    println!("Would move {} files ({:.2} GB) to cloud:", files_to_move.len(), total_size as f64 / 1_000_000_000.0);
    for (file_path, size) in files_to_move {
        println!("  - {:?} ({:.2} MB)", file_path, size as f64 / 1_000_000.0);
    }
    
    println!("Cloud move completed (simulated)");
    Ok(())
}

#[tauri::command]
pub fn clean_selected_items(items: Vec<CleanupSuggestionItem>, scan_results: State<'_, SharedScanResults>) -> Result<(), CommandError> {
    let results = scan_results.lock().unwrap();
    
    for item in items {
        match item.cleanup_type.as_str() {
            "Potential Duplicate Files" => {
                let mut size_groups: HashMap<u64, Vec<&ScannedFile>> = HashMap::new();
                for file in &results.largest_files {
                    size_groups.entry(file.size).or_insert_with(Vec::new).push(file);
                }
                
                for (size, files) in size_groups {
                    if files.len() > 1 && size > 10_000 {
                        for file in files.iter().skip(1) {
                            if file.path.exists() {
                                match fs::remove_file(&file.path) {
                                    Ok(()) => println!("Removed duplicate file: {:?}", file.path),
                                    Err(e) => println!("Failed to remove duplicate {:?}: {}", file.path, e),
                                }
                            }
                        }
                    }
                }
            },
            "Backup Files" => {
                for file in &results.largest_files {
                    let name_lower = file.name.to_lowercase();
                    if name_lower.contains("backup") || name_lower.contains("bak") || 
                       name_lower.contains("~") || name_lower.ends_with(".old") ||
                       name_lower.contains("copy") || name_lower.contains("temp") {
                        if file.path.exists() {
                            match fs::remove_file(&file.path) {
                                Ok(()) => println!("Removed backup file: {:?}", file.path),
                                Err(e) => println!("Failed to remove backup {:?}: {}", file.path, e),
                            }
                        }
                    }
                }
            },
            "Empty Folders" => {
                for folder in &results.all_folders {
                    if folder.file_count == 0 && folder.path.exists() {
                        match fs::remove_dir(&folder.path) {
                            Ok(()) => println!("Removed empty folder: {:?}", folder.path),
                            Err(e) => println!("Failed to remove empty folder {:?}: {}", folder.path, e),
                        }
                    }
                }
            },
            "Old Large Files (>1 year)" => {
                let now = SystemTime::now();
                for file in &results.largest_files {
                    if file.size > 100_000_000 && file.path.exists() {
                        if let Ok(metadata) = fs::metadata(&file.path) {
                            if let Ok(modified) = metadata.modified() {
                                if let Ok(duration) = now.duration_since(modified) {
                                    if duration.as_secs() > 365 * 24 * 3600 {
                                        match fs::remove_file(&file.path) {
                                            Ok(()) => println!("Removed old large file: {:?}", file.path),
                                            Err(e) => println!("Failed to remove old file {:?}: {}", file.path, e),
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "Temporary Files" => {
                for file in &results.largest_files {
                    let name_lower = file.name.to_lowercase();
                    let path_lower = file.path.to_string_lossy().to_lowercase();
                    if name_lower.starts_with("tmp") || name_lower.starts_with("temp") ||
                       path_lower.contains("/tmp/") || path_lower.contains("/temp/") ||
                       path_lower.contains("\\tmp\\") || path_lower.contains("\\temp\\") ||
                       file.extension == "tmp" || file.extension == "temp" {
                        if file.path.exists() {
                            match fs::remove_file(&file.path) {
                                Ok(()) => println!("Removed temporary file: {:?}", file.path),
                                Err(e) => println!("Failed to remove temp file {:?}: {}", file.path, e),
                            }
                        }
                    }
                }
            },
            _ => {
                println!("Unknown cleanup type: {}", item.cleanup_type);
            }
        }
    }
    
    println!("Cleanup completed");
    Ok(())
}