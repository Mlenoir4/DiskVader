use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering, AtomicBool};
use chrono::Utc;

#[derive(Debug, thiserror::Error, Serialize)]
pub enum CommandError {
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
pub struct ScanProgress {
    #[serde(rename = "filesAnalyzed")]
    pub files_analyzed: u32,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    #[serde(rename = "foldersAnalyzed")]
    pub folders_analyzed: u32,
    #[serde(rename = "currentPath")]
    pub current_path: String,
    #[serde(rename = "progressPercentage")]
    pub progress_percentage: f64,
    #[serde(rename = "estimatedTotalSize")]
    pub estimated_total_size: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ScanData {
    pub total_files: u32,
    pub total_folders: u32,
    pub total_size: u64,
    pub free_space: u64,
    pub used_percentage: f32,
    pub scan_time: f32,
    pub scan_path: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FileItem {
    pub id: u32,
    pub name: String,
    pub path: String,
    pub size: u64,
    #[serde(rename = "type")]
    pub file_type: String,
    pub extension: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FolderItem {
    pub id: u32,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub file_count: u32,
    pub percentage: f32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FileTypeDistributionItem {
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: u64,
    pub count: u32,
    pub color: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PieChartDataItem {
    pub name: String,
    pub value: f32,
    pub color: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct GrowthDataItem {
    pub name: String,
    pub value: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CleanupSuggestionItem {
    #[serde(rename = "type")]
    pub cleanup_type: String,
    pub size: u64,
    pub count: u32,
    pub color_class: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TrashInfo {
    pub size: u64,
    pub count: u32,
}

#[derive(Clone, Debug)]
pub struct ScannedFile {
    pub name: String,
    pub path: PathBuf,
    pub size: u64,
    pub file_type: String,
    pub extension: String,
}

#[derive(Clone, Debug)]
pub struct ScannedFolder {
    pub name: String,
    pub path: PathBuf,
    pub size: u64,
    pub file_count: u32,
}

#[derive(Clone, Debug)]
pub struct ScanResults {
    pub total_files: u32,
    pub total_folders: u32,
    pub total_size: u64,
    pub scan_time: f32,
    pub scan_path: String,
    pub largest_files: Vec<ScannedFile>,
    pub folders: Vec<ScannedFolder>,
    pub all_folders: Vec<ScannedFolder>,
    pub file_type_distribution: HashMap<String, (u64, u32)>,
    pub cancellation_flag: Arc<AtomicBool>,
    pub error_logger: ErrorLogger,
    pub has_error: bool,
    pub error_data: Option<ErrorData>,
}

impl Default for ScanResults {
    fn default() -> Self {
        ScanResults {
            total_files: 0,
            total_folders: 0,
            total_size: 0,
            scan_time: 0.0,
            scan_path: String::new(),
            largest_files: Vec::new(),
            folders: Vec::new(),
            all_folders: Vec::new(),
            file_type_distribution: HashMap::new(),
            cancellation_flag: Arc::new(AtomicBool::new(false)),
            error_logger: ErrorLogger::new(),
            has_error: false,
            error_data: None,
        }
    }
}

#[derive(Clone)]
pub struct AtomicCounters {
    pub files_analyzed: Arc<AtomicU32>,
    pub total_size: Arc<AtomicU64>,
    pub folder_count: Arc<AtomicU32>,
    pub current_path: Arc<Mutex<String>>,
}

impl AtomicCounters {
    pub fn new() -> Self {
        Self {
            files_analyzed: Arc::new(AtomicU32::new(0)),
            total_size: Arc::new(AtomicU64::new(0)),
            folder_count: Arc::new(AtomicU32::new(0)),
            current_path: Arc::new(Mutex::new("Starting...".to_string())),
        }
    }
    
    pub fn get_values(&self) -> (u32, u64, u32) {
        (
            self.files_analyzed.load(Ordering::Relaxed),
            self.total_size.load(Ordering::Relaxed),
            self.folder_count.load(Ordering::Relaxed),
        )
    }
    
    pub fn update_current_path(&self, path: &str) {
        if let Ok(mut current_path) = self.current_path.lock() {
            *current_path = path.to_string();
        }
    }
}

#[derive(Debug)]
pub struct ThreadScanResult {
    pub files: Vec<ScannedFile>,
    pub folders: Vec<ScannedFolder>,
    pub file_type_distribution: HashMap<String, (u64, u32)>,
}

pub type SharedScanResults = Arc<Mutex<ScanResults>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorLog {
    pub id: u32,
    pub timestamp: String,
    pub level: String,
    pub message: String,
    pub path: Option<String>,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorData {
    pub error_code: String,
    pub timestamp: String,
    pub path: String,
    pub files_scanned: u32,
    pub data_analyzed: u64,
    pub scan_duration: f32,
    pub error_logs: Vec<ErrorLog>,
}

#[derive(Debug, Clone)]
pub struct ErrorLogger {
    pub logs: Arc<Mutex<Vec<ErrorLog>>>,
    pub current_id: Arc<AtomicU32>,
}

impl ErrorLogger {
    pub fn new() -> Self {
        Self {
            logs: Arc::new(Mutex::new(Vec::new())),
            current_id: Arc::new(AtomicU32::new(1)),
        }
    }
    
    pub fn log_info(&self, message: &str, path: Option<&str>) {
        self.log("INFO", message, path, None);
    }
    
    pub fn log_error(&self, message: &str, path: Option<&str>, error_code: Option<&str>) {
        self.log("ERROR", message, path, error_code);
    }
    
    pub fn log_warning(&self, message: &str, path: Option<&str>) {
        self.log("WARN", message, path, None);
    }
    
    fn log(&self, level: &str, message: &str, path: Option<&str>, error_code: Option<&str>) {
        if let Ok(mut logs) = self.logs.lock() {
            let id = self.current_id.fetch_add(1, Ordering::Relaxed);
            let timestamp = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            
            logs.push(ErrorLog {
                id,
                timestamp,
                level: level.to_string(),
                message: message.to_string(),
                path: path.map(|p| p.to_string()),
                error_code: error_code.map(|c| c.to_string()),
            });
            
            // Garder seulement les 1000 derniers logs
            if logs.len() > 1000 {
                let excess = logs.len() - 1000;
                logs.drain(0..excess);
            }
        }
    }
    
    pub fn get_logs(&self) -> Vec<ErrorLog> {
        if let Ok(logs) = self.logs.lock() {
            logs.clone()
        } else {
            Vec::new()
        }
    }
    
    pub fn clear_logs(&self) {
        if let Ok(mut logs) = self.logs.lock() {
            logs.clear();
            self.current_id.store(1, Ordering::Relaxed);
        }
    }
}
