use tauri::{AppHandle, State, Emitter};
use tauri_plugin_dialog::DialogExt;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use std::sync::Arc;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use sysinfo::{System, Disks};

use crate::models::{CommandError, ScanProgress, ScanData, FileItem, FolderItem, FileTypeDistributionItem, PieChartDataItem, GrowthDataItem, ScannedFile, ScannedFolder, AtomicCounters, ThreadScanResult, SharedScanResults, ScanResults};

#[tauri::command]
pub async fn select_folder(app: AppHandle) -> Result<Option<String>, CommandError> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |folder_path| {
        tx.send(folder_path.map(|p| p.to_string()))
            .unwrap();
    });
    Ok(rx.recv().unwrap())
}

#[tauri::command]
pub async fn start_scan(app: AppHandle, path: String, scan_results: State<'_, SharedScanResults>) -> Result<(), CommandError> {
    println!("Starting multithreaded scan on: {}", path);
    
    let scan_path = Path::new(&path);
    if !scan_path.exists() {
        return Err(CommandError::PathDoesNotExist(path));
    }
    
    if !scan_path.is_dir() {
        return Err(CommandError::PathIsNotDirectory(path));
    }
    
    let cancellation_flag = {
        let mut results = scan_results.lock().unwrap();
        *results = ScanResults::default();
        results.scan_path = path.clone();
        results.cancellation_flag.store(false, Ordering::Relaxed);
        results.cancellation_flag.clone()
    };
    
    let start_time = Instant::now();
    
    // Estimation rapide sans double traversée
    let estimated_total_size = estimate_total_size_fast(scan_path);
    println!("Estimated total size: {:.2} GB", estimated_total_size as f64 / 1_000_000_000.0);
    
    let counters = AtomicCounters::new();
    
    let _ = app.emit("scan_progress", ScanProgress {
        files_analyzed: 0,
        total_size: 0,
        folders_analyzed: 0,
        current_path: "Collecting directories...".to_string(),
        progress_percentage: 0.0,
        estimated_total_size,
    });
    
    let result = match scan_directory_optimized(
        &app,
        scan_path,
        counters.clone(),
        cancellation_flag,
        estimated_total_size,
    ).await {
        Ok(thread_results) => {
            let elapsed = start_time.elapsed().as_secs_f32();
            let (total_files, total_size, total_folders) = counters.get_values();
            
            println!("Multithreaded scan completed in {:.2} seconds", elapsed);
            println!("Total files analyzed: {}", total_files);
            println!("Total size: {} bytes", total_size);
            println!("Total folders: {}", total_folders);
            
            let mut all_files = Vec::new();
            let mut all_folders = Vec::new();
            let mut combined_file_type_distribution: HashMap<String, (u64, u32)> = HashMap::new();
            
            for result in thread_results {
                all_files.extend(result.files);
                all_folders.extend(result.folders);
                
                for (file_type, (size, count)) in result.file_type_distribution {
                    let entry = combined_file_type_distribution.entry(file_type).or_insert((0, 0));
                    entry.0 += size;
                    entry.1 += count;
                }
            }
            
            all_files.sort_by(|a, b| b.size.cmp(&a.size));

            let all_folders_recursive = calculate_recursive_folder_data(all_folders);
            
            {
                let mut results = scan_results.lock().unwrap();
                *results = ScanResults {
                    total_files,
                    total_folders,
                    total_size,
                    scan_time: elapsed,
                    scan_path: path.clone(),
                    largest_files: all_files,
                    folders: all_folders_recursive.clone(),
                    all_folders: all_folders_recursive,
                    file_type_distribution: combined_file_type_distribution,
                    cancellation_flag: Arc::new(AtomicBool::new(false)),
                };
            }
            
            let _ = app.emit("scan_progress", ScanProgress {
                files_analyzed: total_files,
                total_size,
                folders_analyzed: total_folders,
                current_path: "Scan completed!".to_string(),
                progress_percentage: 100.0,
                estimated_total_size,
            });
            
            Ok(())
        }
        Err(e) => {
            let _ = app.emit("scan_progress", ScanProgress {
                files_analyzed: 0,
                total_size: 0,
                folders_analyzed: 0,
                current_path: "Scan failed!".to_string(),
                progress_percentage: 0.0,
                estimated_total_size,
            });
            
            Err(CommandError::ScanFailed(e.to_string()))
        }
    };
    
    result
}

#[tauri::command]
pub fn cancel_scan(scan_results: State<'_, SharedScanResults>) -> Result<(), CommandError> {
    println!("Cancelling scan...");
    let results = scan_results.lock().unwrap();
    results.cancellation_flag.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn get_scan_results(scan_results: State<'_, SharedScanResults>) -> Result<ScanData, CommandError> {
    let results = scan_results.lock().unwrap();
    
    let _sys = System::new_all();
    let disks = Disks::new_with_refreshed_list();
    
    let mut free_space = 0u64;
    if let Some(disk) = disks.iter().find(|d| results.scan_path.starts_with(d.mount_point().to_string_lossy().as_ref())) {
        free_space = disk.available_space();
    } else if let Some(disk) = disks.iter().find(|d| d.mount_point() == Path::new("/")) {
        free_space = disk.available_space();
    }

    let used_percentage = if results.total_size > 0 || free_space > 0 {
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
pub fn get_largest_files(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FileItem>, CommandError> {
    let results = scan_results.lock().unwrap();
    
    let file_items: Vec<FileItem> = results.largest_files.iter()
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
    Ok(file_items)
}

#[tauri::command]
pub fn get_folders(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FolderItem>, CommandError> {
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
pub fn get_all_folders(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FolderItem>, CommandError> {
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
pub fn get_folder_files(folder_path: String) -> Result<Vec<FileItem>, CommandError> {
    let entries = fs::read_dir(&folder_path)
        .map_err(|e| CommandError::CannotReadDirectory(format!("{}: {}", folder_path, e)))?;
    
    let mut files = Vec::new();
    let mut id = 1;
    
    for entry in entries {
        let entry = entry.map_err(|e| CommandError::InternalError(format!("Error reading directory entry: {}", e)))?;
        let path = entry.path();
        
        if path.is_file() {
            let metadata = entry.metadata()
                .map_err(|e| CommandError::CannotGetMetadata(format!("Cannot get metadata for file: {}", e)))?;
            
            let file_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();
            
            let file_extension = path.extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("")
                .to_lowercase();
            
            let file_type = get_file_type(&file_extension);
            let file_size = metadata.len();
            
            files.push(FileItem {
                id,
                name: file_name,
                path: path.to_string_lossy().to_string(),
                size: file_size,
                file_type,
                extension: file_extension,
            });
            
            id += 1;
        }
    }
    
    files.sort_by(|a, b| b.size.cmp(&a.size));
    
    Ok(files)
}

#[tauri::command]
pub fn get_file_type_distribution(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FileTypeDistributionItem>, CommandError> {
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
    
    distribution.sort_by(|a, b| b.size.cmp(&a.size));
    
    Ok(distribution)
}

#[tauri::command]
pub fn get_pie_chart_data(scan_results: State<'_, SharedScanResults>) -> Result<Vec<PieChartDataItem>, CommandError> {
    let results = scan_results.lock().unwrap();
    
    let colors = [
        "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
        "#ef4444", "#06b6d4", "#84cc16", "#f97316"
    ];
    
    let mut chart_data: Vec<PieChartDataItem> = results.file_type_distribution.iter()
        .enumerate()
        .map(|(index, (file_type, (size, _)))| PieChartDataItem {
            name: file_type.clone(),
            value: *size as f32 / 1_000_000_000.0,
            color: colors[index % colors.len()].to_string(),
        })
        .filter(|item| item.value > 0.0)
        .collect();
    
    chart_data.sort_by(|a, b| b.value.partial_cmp(&a.value).unwrap());
    chart_data.truncate(6);
    
    Ok(chart_data)
}

#[tauri::command]
pub fn get_doughnut_data(scan_results: State<'_, SharedScanResults>) -> Result<Vec<PieChartDataItem>, CommandError> {
    let results = scan_results.lock().unwrap();
    
    let colors = [
        "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
        "#ef4444", "#06b6d4", "#84cc16", "#f97316"
    ];
    
    let mut chart_data: Vec<PieChartDataItem> = results.file_type_distribution.iter()
        .enumerate()
        .map(|(index, (file_type, (size, _)))| PieChartDataItem {
            name: file_type.clone(),
            value: *size as f32 / 1_000_000_000.0,
            color: colors[index % colors.len()].to_string(),
        })
        .filter(|item| item.value > 0.0)
        .collect();
    
    chart_data.sort_by(|a, b| b.value.partial_cmp(&a.value).unwrap());
    
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
pub fn get_trend_data(period: Option<String>, scan_results: State<'_, SharedScanResults>) -> Result<Vec<GrowthDataItem>, CommandError> {
    let results = scan_results.lock().unwrap();
    let period = period.unwrap_or_else(|| "30D".to_string());
    
    let base_value = (results.total_size as f32 / 1_000_000_000.0) as u32; // en GB
    
    match period.as_str() {
        "7D" => {
            let daily_growth = std::cmp::max(1, base_value / 50); // Croissance d'environ 2% par jour
            Ok(vec![
                GrowthDataItem { name: "Mon".to_string(), value: base_value.saturating_sub(daily_growth * 6) },
                GrowthDataItem { name: "Tue".to_string(), value: base_value.saturating_sub(daily_growth * 5) },
                GrowthDataItem { name: "Wed".to_string(), value: base_value.saturating_sub(daily_growth * 4) },
                GrowthDataItem { name: "Thu".to_string(), value: base_value.saturating_sub(daily_growth * 3) },
                GrowthDataItem { name: "Fri".to_string(), value: base_value.saturating_sub(daily_growth * 2) },
                GrowthDataItem { name: "Sat".to_string(), value: base_value.saturating_sub(daily_growth) },
                GrowthDataItem { name: "Sun".to_string(), value: base_value },
            ])
        },
        "30D" => {
            let weekly_growth = std::cmp::max(1, base_value / 20); // Croissance d'environ 5% par semaine
            Ok(vec![
                GrowthDataItem { name: "Week 1".to_string(), value: base_value.saturating_sub(weekly_growth * 3) },
                GrowthDataItem { name: "Week 2".to_string(), value: base_value.saturating_sub(weekly_growth * 2) },
                GrowthDataItem { name: "Week 3".to_string(), value: base_value.saturating_sub(weekly_growth) },
                GrowthDataItem { name: "Week 4".to_string(), value: base_value },
            ])
        },
        "90D" => {
            let monthly_growth = std::cmp::max(1, base_value / 10); // Croissance d'environ 10% par mois
            Ok(vec![
                GrowthDataItem { name: "Jan".to_string(), value: base_value.saturating_sub(monthly_growth * 2) },
                GrowthDataItem { name: "Feb".to_string(), value: base_value.saturating_sub(monthly_growth) },
                GrowthDataItem { name: "Mar".to_string(), value: base_value },
            ])
        },
        _ => {
            let weekly_growth = std::cmp::max(1, base_value / 20);
            Ok(vec![
                GrowthDataItem { name: "Week 1".to_string(), value: base_value.saturating_sub(weekly_growth * 3) },
                GrowthDataItem { name: "Week 2".to_string(), value: base_value.saturating_sub(weekly_growth * 2) },
                GrowthDataItem { name: "Week 3".to_string(), value: base_value.saturating_sub(weekly_growth) },
                GrowthDataItem { name: "Week 4".to_string(), value: base_value },
            ])
        }
    }
}

#[tauri::command]
pub fn get_growth_data(scan_results: State<'_, SharedScanResults>) -> Result<Vec<GrowthDataItem>, CommandError> {
    let results = scan_results.lock().unwrap();
    
    let current_size = (results.total_size as f32 / 1_000_000_000.0) as u32; // en GB
    let monthly_growth = std::cmp::max(5, current_size / 10); // Croissance d'environ 10% par mois
    
    Ok(vec![
        GrowthDataItem { name: "Jan 2025".to_string(), value: current_size.saturating_sub(monthly_growth * 5) },
        GrowthDataItem { name: "Feb 2025".to_string(), value: current_size.saturating_sub(monthly_growth * 4) },
        GrowthDataItem { name: "Mar 2025".to_string(), value: current_size.saturating_sub(monthly_growth * 3) },
        GrowthDataItem { name: "Apr 2025".to_string(), value: current_size.saturating_sub(monthly_growth * 2) },
        GrowthDataItem { name: "May 2025".to_string(), value: current_size.saturating_sub(monthly_growth) },
        GrowthDataItem { name: "Jun 2025".to_string(), value: current_size },
    ])
}

pub fn calculate_recursive_folder_data(
    folders: Vec<ScannedFolder>, 
) -> Vec<ScannedFolder> {
    let mut path_data: HashMap<PathBuf, (u64, u32)> = HashMap::new();

    for folder in &folders {
        path_data.insert(folder.path.clone(), (folder.size, folder.file_count));
    }

    let mut all_folder_paths: Vec<PathBuf> = path_data.keys().cloned().collect();
    all_folder_paths.sort_by_key(|p| p.components().count());
    all_folder_paths.reverse(); 

    for folder_path in &all_folder_paths {
        let (current_folder_recursive_size, current_folder_recursive_count) =
            path_data.get(folder_path).copied().unwrap_or((0, 0));

        if let Some(parent_path) = folder_path.parent() {
            let parent_entry = path_data.entry(parent_path.to_path_buf()).or_insert((0, 0));
            parent_entry.0 += current_folder_recursive_size;
            parent_entry.1 += current_folder_recursive_count;
        }
    }

    let mut updated_folders = Vec::new();
    for folder_path in all_folder_paths {
        if let Some(&(recursive_size, recursive_count)) = path_data.get(&folder_path) {
            let name = folder_path.file_name()
                .unwrap_or_else(|| folder_path.as_os_str())
                .to_string_lossy()
                .to_string();
            updated_folders.push(ScannedFolder {
                name,
                path: folder_path,
                size: recursive_size,
                file_count: recursive_count,
            });
        }
    }
    updated_folders.sort_by_key(|f| f.path.clone()); 
    updated_folders
}

pub async fn scan_directory_optimized(
    app: &AppHandle,
    root_path: &Path,
    counters: AtomicCounters,
    cancellation_flag: Arc<AtomicBool>,
    estimated_total_size: u64,
) -> Result<Vec<ThreadScanResult>, CommandError> {
    let num_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .max(2)
        .min(8); // Limiter à 8 threads max
    
    println!("Using {} threads for optimized scanning", num_threads);
    
    let (tx, rx) = std::sync::mpsc::channel::<PathBuf>();
    let rx = Arc::new(std::sync::Mutex::new(rx));
    
    // Thread producteur pour découvrir les répertoires
    let producer_cancellation = Arc::clone(&cancellation_flag);
    let root_path_clone = root_path.to_path_buf();
    let producer_handle = std::thread::spawn(move || {
        discover_directories_efficiently(&root_path_clone, &tx, &producer_cancellation);
    });
    
    // Threads consommateurs
    let mut handles = Vec::new();
    for thread_id in 0..num_threads {
        let rx_clone = Arc::clone(&rx);
        let counters = counters.clone();
        let app_clone = app.clone();
        let cancellation_flag_clone = Arc::clone(&cancellation_flag);
        
        let handle = std::thread::spawn(move || {
            worker_thread_optimized(
                thread_id,
                rx_clone,
                counters,
                app_clone,
                cancellation_flag_clone,
                estimated_total_size,
            )
        });
        handles.push(handle);
    }
    
    // Attendre le producteur
    let _ = producer_handle.join();
    
    // Attendre tous les consommateurs
    let mut all_results = Vec::new();
    for handle in handles {
        match handle.join() {
            Ok(result) => all_results.push(result),
            Err(e) => println!("Thread panicked: {:?}", e),
        }
    }
    
    println!("Collected results from {} optimized thread(s)", all_results.len());
    Ok(all_results)
}

// Fonctions supprimées car remplacées par les versions optimisées

// Ancienne fonction scan_single_directory supprimée car remplacée par scan_single_directory_optimized

pub fn get_file_type(extension: &str) -> String {
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

// Anciennes fonctions supprimées car remplacées par les versions optimisées

// Nouvelles fonctions optimisées

pub fn discover_directories_efficiently(
    root_path: &PathBuf,
    tx: &std::sync::mpsc::Sender<PathBuf>,
    cancellation_flag: &Arc<AtomicBool>,
) {
    let mut stack = vec![root_path.clone()];
    
    while let Some(current_path) = stack.pop() {
        if cancellation_flag.load(Ordering::Relaxed) {
            break;
        }
        
        if let Err(_) = tx.send(current_path.clone()) {
            break; // Canal fermé
        }
        
        if let Ok(entries) = fs::read_dir(&current_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                }
            }
        }
    }
}

pub fn worker_thread_optimized(
    thread_id: usize,
    rx: Arc<std::sync::Mutex<std::sync::mpsc::Receiver<PathBuf>>>,
    counters: AtomicCounters,
    app: AppHandle,
    cancellation_flag: Arc<AtomicBool>,
    estimated_total_size: u64,
) -> ThreadScanResult {
    println!("Optimized worker thread {} started", thread_id);
    
    let mut thread_files = Vec::new();
    let mut thread_folders = Vec::new();
    let mut thread_file_type_distribution: HashMap<String, (u64, u32)> = HashMap::new();
    let mut files_processed_since_emit = 0u32;
    let mut last_emit_percentage = 0.0f64;
    
    // Réserver de l'espace pour éviter les réallocations
    thread_files.reserve(1000);
    thread_folders.reserve(100);
    
    loop {
        if cancellation_flag.load(Ordering::Relaxed) {
            break;
        }
        
        let directory = {
            let receiver = rx.lock().unwrap();
            receiver.recv()
        };
        
        match directory {
            Ok(dir_path) => {
                if let Err(e) = scan_single_directory_optimized(
                    &dir_path,
                    &mut thread_files,
                    &mut thread_folders,
                    &mut thread_file_type_distribution,
                    &counters,
                    &app,
                    &cancellation_flag,
                    estimated_total_size,
                    &mut files_processed_since_emit,
                    &mut last_emit_percentage,
                ) {
                    println!("Thread {} error scanning {:?}: {}", thread_id, dir_path, e);
                }
            },
            Err(_) => break, // Canal fermé, plus de répertoires
        }
    }
    
    println!("Optimized worker thread {} finished", thread_id);
    
    ThreadScanResult {
        files: thread_files,
        folders: thread_folders,
        file_type_distribution: thread_file_type_distribution,
    }
}

pub fn scan_single_directory_optimized(
    dir_path: &PathBuf,
    thread_files: &mut Vec<ScannedFile>,
    thread_folders: &mut Vec<ScannedFolder>,
    file_type_distribution: &mut HashMap<String, (u64, u32)>,
    counters: &AtomicCounters,
    app: &AppHandle,
    cancellation_flag: &AtomicBool,
    estimated_total_size: u64,
    files_processed_since_emit: &mut u32,
    last_emit_percentage: &mut f64,
) -> Result<(), CommandError> {
    if cancellation_flag.load(Ordering::Relaxed) {
        return Ok(());
    }

    let entries = match fs::read_dir(dir_path) {
        Ok(entries) => entries,
        Err(_) => return Ok(()), // Ignorer silencieusement les erreurs de lecture
    };
    
    counters.folder_count.fetch_add(1, Ordering::Relaxed);
    counters.update_current_path(&dir_path.to_string_lossy());
    
    let mut current_folder_size = 0u64;
    let mut current_folder_file_count = 0u32;
    const MIN_FILE_SIZE_THRESHOLD: u64 = 100_000; // 100KB au lieu de 10KB
    
    for entry in entries {
        if cancellation_flag.load(Ordering::Relaxed) {
            return Ok(());
        }

        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue, // Ignorer les erreurs d'entrée
        };
        
        let entry_path = entry.path();
        
        if entry_path.is_file() {
            if let Ok(metadata) = entry.metadata() {
                let file_size = metadata.len();
                counters.files_analyzed.fetch_add(1, Ordering::Relaxed);
                counters.total_size.fetch_add(file_size, Ordering::Relaxed);
                current_folder_size += file_size;
                current_folder_file_count += 1;
                
                let extension = entry_path.extension()
                    .and_then(|ext| ext.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                
                let file_type = get_file_type_cached(&extension);
                
                let counter = file_type_distribution.entry(file_type.clone()).or_insert((0, 0));
                counter.0 += file_size;
                counter.1 += 1;
                
                // Stocker seulement les fichiers significatifs
                if file_size > MIN_FILE_SIZE_THRESHOLD {
                    thread_files.push(ScannedFile {
                        name: entry_path.file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        path: entry_path,
                        size: file_size,
                        file_type,
                        extension,
                    });
                }
                
                // Émission de progrès optimisée
                *files_processed_since_emit += 1;
                if *files_processed_since_emit >= 500 { // Réduire la fréquence d'émission
                    let (total_files, total_size, total_folders) = counters.get_values();
                    let progress_percentage = if estimated_total_size > 0 {
                        (total_size as f64 / estimated_total_size as f64 * 100.0).min(99.9)
                    } else {
                        0.0
                    };
                    
                    if (progress_percentage - *last_emit_percentage).abs() >= 1.0 {
                        let progress = ScanProgress {
                            files_analyzed: total_files,
                            total_size,
                            folders_analyzed: total_folders,
                            current_path: dir_path.to_string_lossy().to_string(),
                            progress_percentage,
                            estimated_total_size,
                        };
                        
                        let _ = app.emit("scan_progress", progress);
                        *last_emit_percentage = progress_percentage;
                        *files_processed_since_emit = 0;
                    }
                }
            }
        }
    }
    
    if current_folder_size > 0 {
        thread_folders.push(ScannedFolder {
            name: dir_path.file_name()
                .unwrap_or_else(|| dir_path.as_os_str())
                .to_string_lossy()
                .to_string(),
            path: dir_path.clone(),
            size: current_folder_size,
            file_count: current_folder_file_count,
        });
    }
    
    Ok(())
}

// Cache pour les types de fichiers
static FILE_TYPE_CACHE: std::sync::OnceLock<HashMap<String, String>> = std::sync::OnceLock::new();

pub fn get_file_type_cached(extension: &str) -> String {
    let cache = FILE_TYPE_CACHE.get_or_init(|| {
        let mut map = HashMap::new();
        // Video
        for ext in ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v"] {
            map.insert(ext.to_string(), "Video Files".to_string());
        }
        // Images
        for ext in ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "svg", "webp", "raw", "psd"] {
            map.insert(ext.to_string(), "Images".to_string());
        }
        // Documents
        for ext in ["pdf", "doc", "docx", "txt", "rtf", "odt", "pages"] {
            map.insert(ext.to_string(), "Documents".to_string());
        }
        // Archives
        for ext in ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"] {
            map.insert(ext.to_string(), "Archives".to_string());
        }
        // Audio
        for ext in ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"] {
            map.insert(ext.to_string(), "Audio Files".to_string());
        }
        // Applications
        for ext in ["exe", "app", "deb", "rpm", "dmg", "msi"] {
            map.insert(ext.to_string(), "Applications".to_string());
        }
        map
    });
    
    cache.get(extension).cloned().unwrap_or_else(|| "Other".to_string())
}

pub fn estimate_total_size_fast(path: &Path) -> u64 {
    use std::collections::VecDeque;
    
    let mut queue = VecDeque::new();
    queue.push_back(path.to_path_buf());
    
    let mut total_size = 0u64;
    let mut dirs_sampled = 0;
    const MAX_DIRS_TO_SAMPLE: usize = 20;
    
    while let Some(current_path) = queue.pop_front() {
        if dirs_sampled >= MAX_DIRS_TO_SAMPLE {
            break;
        }
        
        if let Ok(entries) = fs::read_dir(&current_path) {
            let mut dir_size = 0u64;
            let mut file_count = 0;
            
            for entry in entries.take(50) { // Échantillonner seulement 50 entrées
                if let Ok(entry) = entry {
                    let entry_path = entry.path();
                    if entry_path.is_file() {
                        if let Ok(metadata) = entry.metadata() {
                            dir_size += metadata.len();
                            file_count += 1;
                        }
                    } else if entry_path.is_dir() && queue.len() < 100 {
                        queue.push_back(entry_path);
                    }
                }
            }
            
            // Extrapoler la taille basée sur l'échantillon
            if file_count > 10 {
                total_size += dir_size * 3; // Facteur d'extrapolation
            } else {
                total_size += dir_size;
            }
            
            dirs_sampled += 1;
        }
    }
    
    total_size.max(1_000_000) // Au moins 1MB
}

