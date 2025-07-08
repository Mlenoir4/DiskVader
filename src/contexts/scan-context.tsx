import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ScanData {
  total_files: number;
  total_folders: number;
  total_size: number;
  free_space: number;
  used_percentage: number;
  scan_time: number;
  scan_path: string;
  timestamp: number;
}

export interface FileItem {
  id: number;
  name: string;
  path: string;
  size: number;
  type: string;
  extension: string;
}

export interface FolderItem {
  id: number;
  name: string;
  path?: string;
  size: number;
  file_count: number;
  percentage: number;
}

export interface FileTypeDistribution {
  type: string;
  size: number;
  count: number;
  color: string;
}

export interface ScanContextType {
  scanData: ScanData | null;
  largestFiles: FileItem[];
  folders: FolderItem[];
  fileTypeDistribution: FileTypeDistribution[];
  isDataAvailable: boolean;
  lastScanTime: number | null;
  
  setScanData: (data: ScanData) => void;
  setLargestFiles: (files: FileItem[]) => void;
  setFolders: (folders: FolderItem[]) => void;
  setFileTypeDistribution: (distribution: FileTypeDistribution[]) => void;
  clearAllData: () => void;
  saveScanResults: (
    scanData: ScanData,
    files: FileItem[],
    folders: FolderItem[],
    distribution: FileTypeDistribution[]
  ) => void;
}

const ScanContext = createContext<ScanContextType | undefined>(undefined);

export const useScanContext = () => {
  const context = useContext(ScanContext);
  if (context === undefined) {
    throw new Error('useScanContext must be used within a ScanProvider');
  }
  return context;
};

export const ScanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scanData, setScanDataState] = useState<ScanData | null>(null);
  const [largestFiles, setLargestFilesState] = useState<FileItem[]>([]);
  const [folders, setFoldersState] = useState<FolderItem[]>([]);
  const [fileTypeDistribution, setFileTypeDistributionState] = useState<FileTypeDistribution[]>([]);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);

  // Clés pour localStorage
  const STORAGE_KEYS = {
    SCAN_DATA: 'diskvader_scan_data',
    LARGEST_FILES: 'diskvader_largest_files',
    FOLDERS: 'diskvader_folders',
    FILE_TYPE_DISTRIBUTION: 'diskvader_file_type_distribution',
    LAST_SCAN_TIME: 'diskvader_last_scan_time'
  };

  // Charger les données depuis localStorage au démarrage
  useEffect(() => {
    try {
      const savedScanData = localStorage.getItem(STORAGE_KEYS.SCAN_DATA);
      const savedLargestFiles = localStorage.getItem(STORAGE_KEYS.LARGEST_FILES);
      const savedFolders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
      const savedFileTypeDistribution = localStorage.getItem(STORAGE_KEYS.FILE_TYPE_DISTRIBUTION);
      const savedLastScanTime = localStorage.getItem(STORAGE_KEYS.LAST_SCAN_TIME);

      if (savedScanData) {
        setScanDataState(JSON.parse(savedScanData));
      }
      if (savedLargestFiles) {
        setLargestFilesState(JSON.parse(savedLargestFiles));
      }
      if (savedFolders) {
        setFoldersState(JSON.parse(savedFolders));
      }
      if (savedFileTypeDistribution) {
        setFileTypeDistributionState(JSON.parse(savedFileTypeDistribution));
      }
      if (savedLastScanTime) {
        setLastScanTime(JSON.parse(savedLastScanTime));
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  }, []);

  // Fonctions pour sauvegarder dans localStorage
  const setScanData = (data: ScanData) => {
    setScanDataState(data);
    localStorage.setItem(STORAGE_KEYS.SCAN_DATA, JSON.stringify(data));
    const timestamp = Date.now();
    setLastScanTime(timestamp);
    localStorage.setItem(STORAGE_KEYS.LAST_SCAN_TIME, JSON.stringify(timestamp));
  };

  const setLargestFiles = (files: FileItem[]) => {
    setLargestFilesState(files);
    localStorage.setItem(STORAGE_KEYS.LARGEST_FILES, JSON.stringify(files));
  };

  const setFolders = (folders: FolderItem[]) => {
    setFoldersState(folders);
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
  };

  const setFileTypeDistribution = (distribution: FileTypeDistribution[]) => {
    setFileTypeDistributionState(distribution);
    localStorage.setItem(STORAGE_KEYS.FILE_TYPE_DISTRIBUTION, JSON.stringify(distribution));
  };

  const clearAllData = () => {
    setScanDataState(null);
    setLargestFilesState([]);
    setFoldersState([]);
    setFileTypeDistributionState([]);
    setLastScanTime(null);
    
    // Supprimer de localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  };

  const saveScanResults = (
    scanData: ScanData,
    files: FileItem[],
    folders: FolderItem[],
    distribution: FileTypeDistribution[]
  ) => {
    setScanData(scanData);
    setLargestFiles(files);
    setFolders(folders);
    setFileTypeDistribution(distribution);
  };

  const isDataAvailable = scanData !== null && scanData.total_files > 0;

  const value: ScanContextType = {
    scanData,
    largestFiles,
    folders,
    fileTypeDistribution,
    isDataAvailable,
    lastScanTime,
    setScanData,
    setLargestFiles,
    setFolders,
    setFileTypeDistribution,
    clearAllData,
    saveScanResults
  };

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
};
