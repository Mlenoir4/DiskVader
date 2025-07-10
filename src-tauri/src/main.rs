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
use std::sync::mpsc;
use std::thread;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};

#[derive(Debug, thiserror::Error, Serialize)]
enum CommandError {
    #[error("Path does not exist: {0}")]
    PathDoesNotExist(String),
    #[error("Path is not a directory: {0}")]
    PathIsNotDirectory(String),
    #[error("Cannot read directory: {0}")]
    CannotReadDirectory(String),
    #[error("Cannot get metadata: {0}")]
    CannotGetMetadata(String),
    #[error("Scan failed: {0}")]
    ScanFailed(String),
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<std::io::Error> for CommandError {
    fn from(err: std::io::Error) -> Self {
        CommandError::InternalError(err.to_string())
    }
}

impl From<std::sync::mpsc::RecvError> for CommandError {
    fn from(err: std::sync::mpsc::RecvError) -> Self {
        CommandError::InternalError(err.to_string())
    }
}

impl From<Box<dyn std::error::Error + Send + Sync>> for CommandError {
    fn from(err: Box<dyn std::error::Error + Send + Sync>) -> Self {
        CommandError::InternalError(err.to_string())
    }
}

impl From<std::sync::PoisonError<std::sync::MutexGuard<'_, ScanResults>>> for CommandError {
    fn from(err: std::sync::PoisonError<std::sync::MutexGuard<'_, ScanResults>>) -> Self {
        CommandError::InternalError(err.to_string())
    }
}

impl From<tauri::Error> for CommandError {
    fn from(err: tauri::Error) -> Self {
        CommandError::InternalError(err.to_string())
    }
}

#[derive(Clone, Serialize)]
struct ScanProgress {
    #[serde(rename = "filesAnalyzed")]
    files_analyzed: u32,
    #[serde(rename = "totalSize")]
    total_size: u64,
    #[serde(rename = "currentPath")]
    current_path: String,
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

#[derive(Clone, Debug, Serialize, Deserialize)]
struct CleanupSuggestionItem {
    #[serde(rename = "type")]
    cleanup_type: String,
    size: u64,
    count: u32,
    color_class: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct TrashInfo {
    size: u64,
    count: u32,
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
    folders: Vec<ScannedFolder>,
    all_folders: Vec<ScannedFolder>,
    file_type_distribution: HashMap<String, (u64, u32)>,
}

// Structure pour les compteurs atomiques partagés entre threads
#[derive(Clone)]
struct AtomicCounters {
    files_analyzed: Arc<AtomicU32>,
    total_size: Arc<AtomicU64>,
    folder_count: Arc<AtomicU32>,
}

impl AtomicCounters {
    fn new() -> Self {
        Self {
            files_analyzed: Arc::new(AtomicU32::new(0)),
            total_size: Arc::new(AtomicU64::new(0)),
            folder_count: Arc::new(AtomicU32::new(0)),
        }
    }
    
    fn get_values(&self) -> (u32, u64, u32) {
        (
            self.files_analyzed.load(Ordering::Relaxed),
            self.total_size.load(Ordering::Relaxed),
            self.folder_count.load(Ordering::Relaxed),
        )
    }
}

// Structure pour les résultats collectés par les threads
#[derive(Debug)]
struct ThreadScanResult {
    files: Vec<ScannedFile>,
    folders: Vec<ScannedFolder>,
    file_type_distribution: HashMap<String, (u64, u32)>,
}

type SharedScanResults = Arc<Mutex<ScanResults>>;

#[tauri::command]
async fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, CommandError> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |folder_path| {
        tx.send(folder_path.map(|p| p.to_string()))
            .unwrap();
    });
    Ok(rx.recv().unwrap())
}

#[tauri::command]
async fn start_scan(app: tauri::AppHandle, path: String, scan_results: State<'_, SharedScanResults>) -> Result<(), CommandError> {
    println!("Starting multithreaded scan on: {}", path);
    
    let scan_path = Path::new(&path);
    if !scan_path.exists() {
        return Err(CommandError::PathDoesNotExist(path));
    }
    
    if !scan_path.is_dir() {
        return Err(CommandError::PathIsNotDirectory(path));
    }
    
    // Reset scan results
    {
        let mut results = scan_results.lock().unwrap();
        *results = ScanResults::default();
        results.scan_path = path.clone();
    }
    
    let start_time = Instant::now();
    
    // Initialiser les compteurs atomiques
    let counters = AtomicCounters::new();
    
    // Démarrer le scan multithread
    match scan_directory_multithreaded(&app, scan_path, counters.clone()).await {
        Ok(thread_results) => {
            let elapsed = start_time.elapsed().as_secs_f32();
            let (total_files, total_size, total_folders) = counters.get_values();
            
            println!("Multithreaded scan completed in {:.2} seconds", elapsed);
            println!("Total files analyzed: {}", total_files);
            println!("Total size: {} bytes", total_size);
            println!("Total folders: {}", total_folders);
            
            // Consolider les résultats de tous les threads
            let mut all_files = Vec::new();
            let mut all_folders = Vec::new();
            let mut combined_file_type_distribution: HashMap<String, (u64, u32)> = HashMap::new();
            
            for result in thread_results {
                all_files.extend(result.files);
                all_folders.extend(result.folders);
                
                // Combiner les distributions de types de fichiers
                for (file_type, (size, count)) in result.file_type_distribution {
                    let entry = combined_file_type_distribution.entry(file_type).or_insert((0, 0));
                    entry.0 += size;
                    entry.1 += count;
                }
            }
            
            // Trier les fichiers par taille décroissante
            all_files.sort_by(|a, b| b.size.cmp(&a.size));

            // Calculer les tailles récursives des dossiers
            let all_folders_recursive = calculate_recursive_folder_data(all_folders);
            
            // Stocker les résultats consolidés
            {
                let mut results = scan_results.lock().unwrap();
                results.total_files = total_files;
                results.total_folders = total_folders;
                results.total_size = total_size;
                results.scan_time = elapsed;
                results.largest_files = all_files;
                results.all_folders = all_folders_recursive.clone();
                results.folders = all_folders_recursive;
                results.file_type_distribution = combined_file_type_distribution;
            }
            
            Ok(())
        }
        Err(e) => Err(CommandError::ScanFailed(e.to_string()))
    }
}

// Fonction pour calculer les tailles récursives des dossiers après le scan
fn calculate_recursive_folder_data(
    folders: Vec<ScannedFolder>, // These are direct folders with their direct file sizes/counts
) -> Vec<ScannedFolder> {
    let mut path_data: HashMap<PathBuf, (u64, u32)> = HashMap::new();

    // Initialize path_data with direct folder sizes and counts
    // This is the base for recursive aggregation
    for folder in &folders {
        path_data.insert(folder.path.clone(), (folder.size, folder.file_count));
    }

    // Collect all unique folder paths and sort them by depth (deepest first)
    let mut all_folder_paths: Vec<PathBuf> = path_data.keys().cloned().collect();
    all_folder_paths.sort_by_key(|p| p.components().count());
    all_folder_paths.reverse(); // Deepest first

    // Aggregate recursively
    for folder_path in &all_folder_paths {
        let (current_folder_recursive_size, current_folder_recursive_count) =
            path_data.get(folder_path).copied().unwrap_or((0, 0));

        if let Some(parent_path) = folder_path.parent() {
            let parent_entry = path_data.entry(parent_path.to_path_buf()).or_insert((0, 0));
            parent_entry.0 += current_folder_recursive_size;
            parent_entry.1 += current_folder_recursive_count;
        }
    }

    // Create new ScannedFolder vector with updated recursive sizes
    let mut updated_folders = Vec::new();
    for folder_path in all_folder_paths {
        if let Some(&(recursive_size, recursive_count)) = path_data.get(&folder_path) {
            // Find the original ScannedFolder to get its name, or derive it.
            // For simplicity, we'll derive the name from the path.
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
    updated_folders.sort_by_key(|f| f.path.clone()); // Sort for consistent output
    updated_folders
}

// Fonction principale de scan multithread
async fn scan_directory_multithreaded(
    app: &tauri::AppHandle,
    root_path: &Path,
    counters: AtomicCounters,
) -> Result<Vec<ThreadScanResult>, CommandError> {
    println!("Starting multithreaded directory scan");
    
    // Déterminer le nombre de threads à utiliser (nombre de CPU logiques)
    let num_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .min(8); // Limiter à 8 threads maximum pour éviter la surcharge
    
    println!("Using {} threads for scanning", num_threads);
    
    // Channel pour collecter les résultats des threads
    let (result_tx, result_rx) = mpsc::channel::<ThreadScanResult>();
    
    // Channel pour distribuer les tâches aux threads
    let (task_tx, task_rx) = mpsc::channel::<PathBuf>();
    let task_rx = Arc::new(Mutex::new(task_rx));
    
    // Cloner l'app handle pour les threads
    let app_handle = app.clone();
    
    // Démarrer les threads de travail
    let mut handles = Vec::new();
    for thread_id in 0..num_threads {
        let task_rx = Arc::clone(&task_rx);
        let result_tx = result_tx.clone();
        let counters = counters.clone();
        let app_clone = app_handle.clone();
        
        let handle = thread::spawn(move || {
            worker_thread(thread_id, task_rx, result_tx, counters, app_clone);
        });
        handles.push(handle);
    }
    
    // Fermer le sender principal
    drop(result_tx);
    
    // Lancer la découverte initiale des dossiers
    let discovery_task_tx = task_tx.clone();
    let root_path_buf = root_path.to_path_buf();
    
    thread::spawn(move || {
        discover_directories(root_path_buf, discovery_task_tx);
    });
    
    // Fermer le channel de tâches après avoir ajouté la racine
    drop(task_tx);
    
    // Attendre que tous les threads se terminent
    for handle in handles {
        if let Err(e) = handle.join() {
            println!("Thread panicked: {:?}", e);
        }
    }
    
    // Collecter tous les résultats
    let mut all_results = Vec::new();
    while let Ok(result) = result_rx.try_recv() {
        all_results.push(result);
    }
    
    println!("Collected results from {} thread(s)", all_results.len());
    Ok(all_results)
}

// Fonction pour découvrir récursivement tous les dossiers
fn discover_directories(root_path: PathBuf, task_tx: mpsc::Sender<PathBuf>) {
    let mut directories_to_explore = vec![root_path];
    
    while let Some(current_dir) = directories_to_explore.pop() {
        // Envoyer le dossier courant pour traitement
        if task_tx.send(current_dir.clone()).is_err() {
            break; // Le receiver a été fermé
        }
        
        // Découvrir les sous-dossiers
        if let Ok(entries) = fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    directories_to_explore.push(path);
                }
            }
        }
    }
}

// Fonction de travail pour chaque thread
fn worker_thread(
    thread_id: usize,
    task_rx: Arc<Mutex<mpsc::Receiver<PathBuf>>>,
    result_tx: mpsc::Sender<ThreadScanResult>,
    counters: AtomicCounters,
    app: tauri::AppHandle,
) {
    println!("Worker thread {} started", thread_id);
    
    let mut thread_files = Vec::new();
    let mut thread_folders = Vec::new();
    let mut thread_file_type_distribution: HashMap<String, (u64, u32)> = HashMap::new();
    let mut progress_counter = 0u32;
    
    loop {
        // Recevoir une tâche
        let directory = {
            let rx = task_rx.lock().unwrap();
            match rx.recv() {
                Ok(dir) => dir,
                Err(_) => break, // Plus de tâches
            }
        };
        
        // Scanner le dossier
        if let Err(e) = scan_single_directory(
            &directory,
            &mut thread_files,
            &mut thread_folders,
            &mut thread_file_type_distribution,
            &counters,
            &app,
            &mut progress_counter,
        ) {
            println!("Thread {} error scanning {:?}: {}", thread_id, directory, e);
        }
    }
    
    // Envoyer les résultats de ce thread
    let result = ThreadScanResult {
        files: thread_files,
        folders: thread_folders,
        file_type_distribution: thread_file_type_distribution,
    };
    
    if result_tx.send(result).is_err() {
        println!("Thread {} failed to send results", thread_id);
    }
    
    println!("Worker thread {} finished", thread_id);
}

// Fonction pour scanner un seul dossier (thread-safe)
fn scan_single_directory(
    dir_path: &PathBuf,
    thread_files: &mut Vec<ScannedFile>,
    thread_folders: &mut Vec<ScannedFolder>,
    file_type_distribution: &mut HashMap<String, (u64, u32)>,
    counters: &AtomicCounters,
    app: &tauri::AppHandle,
    progress_counter: &mut u32,
) -> Result<(), CommandError> {
    let entries = match fs::read_dir(dir_path) {
        Ok(entries) => entries,
        Err(e) => {
            println!("Warning: Cannot read directory {:?}: {}", dir_path, e);
            return Err(CommandError::CannotReadDirectory(dir_path.to_string_lossy().to_string()));
        }
    };
    
    counters.folder_count.fetch_add(1, Ordering::Relaxed);
    let mut current_folder_size = 0u64;
    let mut current_folder_file_count = 0u32;
    
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(e) => {
                println!("Warning: Cannot read entry: {}", e);
                continue;
            }
        };
        
        let entry_path = entry.path();
        
        if entry_path.is_file() {
            match entry.metadata() {
                Ok(metadata) => {
                    let file_size = metadata.len();
                    counters.files_analyzed.fetch_add(1, Ordering::Relaxed);
                    counters.total_size.fetch_add(file_size, Ordering::Relaxed);
                    current_folder_size += file_size;
                    current_folder_file_count += 1;
                    
                    // Traitement du fichier
                    let extension = entry_path.extension()
                        .and_then(|ext| ext.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    
                    let file_type = get_file_type(&extension);
                    
                    // Mise à jour de la distribution des types de fichiers
                    let counter = file_type_distribution.entry(file_type.clone()).or_insert((0, 0));
                    counter.0 += file_size;
                    counter.1 += 1;
                    
                    // Ajouter aux plus gros fichiers si significatif
                    if file_size > 10_000 {
                        thread_files.push(ScannedFile {
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
                    
                    // Émettre le progrès périodiquement pour éviter de surcharger le frontend
                    *progress_counter += 1;
                    if *progress_counter % 500 == 0 {
                        let (total_files, total_size, _) = counters.get_values();
                        let progress = ScanProgress {
                            files_analyzed: total_files,
                            total_size,
                            current_path: dir_path.to_string_lossy().to_string(),
                        };
                        
                        if let Err(e) = app.emit("scan_progress", progress) {
                            println!("Warning: Failed to emit progress: {}", e);
                        }
                    }
                }
                Err(e) => {
                println!("Warning: Cannot get metadata for file {:?}: {}", entry_path, e);
                return Err(CommandError::CannotGetMetadata(entry_path.to_string_lossy().to_string()));
            }
            }
        }
    }
    
    // Ajouter le dossier aux résultats
    if current_folder_size > 0 || current_folder_file_count > 0 {
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
fn get_scan_results(scan_results: State<'_, SharedScanResults>) -> Result<ScanData, CommandError> {
    let results = scan_results.lock().unwrap();
    
    // Get disk space info (this would ideally use a proper disk space library)
    let free_space = 52200000000u64;
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
fn get_largest_files(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FileItem>, CommandError> {
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
fn get_folders(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FolderItem>, CommandError> {
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
fn get_all_folders(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FolderItem>, CommandError> {
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
fn get_folder_files(folder_path: String) -> Result<Vec<FileItem>, CommandError> {
    use std::fs;
    
    // Lire directement le contenu du dossier
    let entries = fs::read_dir(&folder_path)
        .map_err(|e| CommandError::CannotReadDirectory(format!("{}: {}", folder_path, e)))?;
    
    let mut files = Vec::new();
    let mut id = 1;
    
    for entry in entries {
        let entry = entry.map_err(|e| CommandError::InternalError(format!("Error reading directory entry: {}", e)))?;
        let path = entry.path();
        
        // Filtrer seulement les fichiers (pas les dossiers)
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
fn get_file_type_distribution(scan_results: State<'_, SharedScanResults>) -> Result<Vec<FileTypeDistributionItem>, CommandError> {
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
fn get_pie_chart_data(scan_results: State<'_, SharedScanResults>) -> Result<Vec<PieChartDataItem>, CommandError> {
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
    
    // Sort by value descending and take top items
    chart_data.sort_by(|a, b| b.value.partial_cmp(&a.value).unwrap());
    chart_data.truncate(6);
    
    Ok(chart_data)
}

#[tauri::command]
fn get_doughnut_data(scan_results: State<'_, SharedScanResults>) -> Result<Vec<PieChartDataItem>, CommandError> {
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
fn get_trend_data(period: Option<String>) -> Result<Vec<GrowthDataItem>, CommandError> {
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
fn get_growth_data() -> Result<Vec<GrowthDataItem>, CommandError> {
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
fn get_cleanup_suggestions() -> Result<Vec<CleanupSuggestionItem>, CommandError> {
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
fn export_report() -> Result<(), CommandError> {
    println!("Exporting report...");
    // Placeholder for export functionality
    Ok(())
}

#[tauri::command]
fn get_trash_info() -> Result<TrashInfo, CommandError> {
    // Mock trash info - in real implementation, this would check the system trash
    Ok(TrashInfo {
        size: 2400000000, // 2.4 GB
        count: 156,
    })
}

#[tauri::command]
fn empty_trash() -> Result<(), CommandError> {
    println!("Emptying trash...");
    // Placeholder for empty trash functionality
    Ok(())
}

#[tauri::command]
fn delete_file(file_id: u32) -> Result<(), CommandError> {
    println!("Deleting file with ID: {}", file_id);
    // Placeholder for delete file functionality
    Ok(())
}

#[tauri::command]
fn compress_files(file_ids: Vec<u32>) -> Result<(), CommandError> {
    println!("Compressing files with IDs: {:?}", file_ids);
    // Placeholder for compress files functionality
    Ok(())
}

#[tauri::command]
fn move_to_cloud(file_ids: Vec<u32>) -> Result<(), CommandError> {
    println!("Moving files to cloud with IDs: {:?}", file_ids);
    // Placeholder for move to cloud functionality
    Ok(())
}

#[tauri::command]
fn clean_selected_items(items: Vec<CleanupSuggestionItem>) -> Result<(), CommandError> {
    println!("Cleaning selected items: {:?}", items);
    // Placeholder for cleanup functionality
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
            get_trash_info,
            empty_trash,
            delete_file,
            compress_files,
            move_to_cloud,
            clean_selected_items,
            export_report,
        ])
        .run(tauri::generate_context!()) 
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_calculate_recursive_folder_data() {
        // Define some mock files
        let files = vec![
            ScannedFile { name: "file1.txt".to_string(), path: PathBuf::from("/a/b/file1.txt"), size: 100, file_type: "Documents".to_string(), extension: "txt".to_string() },
            ScannedFile { name: "file2.txt".to_string(), path: PathBuf::from("/a/b/file2.txt"), size: 200, file_type: "Documents".to_string(), extension: "txt".to_string() },
            ScannedFile { name: "file3.txt".to_string(), path: PathBuf::from("/a/c/file3.txt"), size: 300, file_type: "Documents".to_string(), extension: "txt".to_string() },
            ScannedFile { name: "file4.txt".to_string(), path: PathBuf::from("/a/file4.txt"), size: 400, file_type: "Documents".to_string(), extension: "txt".to_string() },
            ScannedFile { name: "file5.txt".to_string(), path: PathBuf::from("/a/b/d/file5.txt"), size: 50, file_type: "Documents".to_string(), extension: "txt".to_string() },
        ];

        // Define some mock folders (direct sizes/counts, not recursive yet)
        let folders = vec![
            ScannedFolder { name: "b".to_string(), path: PathBuf::from("/a/b"), size: 300, file_count: 2 }, // files 1 & 2
            ScannedFolder { name: "c".to_string(), path: PathBuf::from("/a/c"), size: 300, file_count: 1 }, // file 3
            ScannedFolder { name: "a".to_string(), path: PathBuf::from("/a"), size: 400, file_count: 1 }, // file 4
            ScannedFolder { name: "d".to_string(), path: PathBuf::from("/a/b/d"), size: 50, file_count: 1 }, // file 5
        ];

        let updated_folders = calculate_recursive_folder_data(folders);

        // Assertions
        // Folder /a/b/d should have size 50, count 1
        let folder_d = updated_folders.iter().find(|f| f.path == PathBuf::from("/a/b/d")).unwrap();
        assert_eq!(folder_d.size, 50);
        assert_eq!(folder_d.file_count, 1);

        // Folder /a/b should have size 350 (100+200+50), count 3 (2+1)
        let folder_b = updated_folders.iter().find(|f| f.path == PathBuf::from("/a/b")).unwrap();
        assert_eq!(folder_b.size, 350);
        assert_eq!(folder_b.file_count, 3);

        // Folder /a/c should have size 300, count 1
        let folder_c = updated_folders.iter().find(|f| f.path == PathBuf::from("/a/c")).unwrap();
        assert_eq!(folder_c.size, 300);
        assert_eq!(folder_c.file_count, 1);

        // Folder /a should have size 1050 (350+300+400), count 5 (3+1+1)
        let folder_a = updated_folders.iter().find(|f| f.path == PathBuf::from("/a")).unwrap();
        assert_eq!(folder_a.size, 1050);
        assert_eq!(folder_a.file_count, 5);
    }
}
