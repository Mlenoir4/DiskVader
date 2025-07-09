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
    console.log('ScanContext: Loading data from localStorage...');
    try {
      const savedScanData = localStorage.getItem(STORAGE_KEYS.SCAN_DATA);
      const savedLargestFiles = localStorage.getItem(STORAGE_KEYS.LARGEST_FILES);
      const savedFolders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
      const savedFileTypeDistribution = localStorage.getItem(STORAGE_KEYS.FILE_TYPE_DISTRIBUTION);
      const savedLastScanTime = localStorage.getItem(STORAGE_KEYS.LAST_SCAN_TIME);

      console.log('ScanContext: Found saved data:', {
        scanData: !!savedScanData,
        largestFiles: !!savedLargestFiles,
        folders: !!savedFolders,
        fileTypeDistribution: !!savedFileTypeDistribution,
        lastScanTime: !!savedLastScanTime
      });

      if (savedScanData) {
        const parsedScanData = JSON.parse(savedScanData);
        console.log('ScanContext: Loaded scan data:', parsedScanData);
        setScanDataState(parsedScanData);
      }
      if (savedLargestFiles) {
        const parsedFiles = JSON.parse(savedLargestFiles);
        console.log('ScanContext: Loaded largest files:', parsedFiles.length);
        setLargestFilesState(parsedFiles);
      }
      if (savedFolders) {
        const parsedFolders = JSON.parse(savedFolders);
        console.log('ScanContext: Loaded folders:', parsedFolders.length);
        setFoldersState(parsedFolders);
      }
      if (savedFileTypeDistribution) {
        const parsedDistribution = JSON.parse(savedFileTypeDistribution);
        console.log('ScanContext: Loaded file type distribution:', parsedDistribution.length);
        setFileTypeDistributionState(parsedDistribution);
      }
      if (savedLastScanTime) {
        const parsedTime = JSON.parse(savedLastScanTime);
        console.log('ScanContext: Loaded last scan time:', new Date(parsedTime).toLocaleString());
        setLastScanTime(parsedTime);
      }
      
      console.log('ScanContext: Data loading completed');
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  }, []);

  // Fonctions pour sauvegarder dans localStorage
  const setScanData = (data: ScanData) => {
    console.log('ScanContext: Setting scan data:', data);
    setScanDataState(data);
    localStorage.setItem(STORAGE_KEYS.SCAN_DATA, JSON.stringify(data));
    const timestamp = Date.now();
    setLastScanTime(timestamp);
    localStorage.setItem(STORAGE_KEYS.LAST_SCAN_TIME, JSON.stringify(timestamp));
    console.log('ScanContext: Scan data saved with timestamp:', new Date(timestamp).toLocaleString());
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
    console.log('ScanContext: Saving scan results...', {
      scanData: scanData ? { total_files: scanData.total_files, total_size: scanData.total_size } : null,
      filesCount: files.length,
      foldersCount: folders.length,
      distributionCount: distribution.length
    });
    
    // Sauvegarder toutes les données de manière atomique
    const timestamp = Date.now();
    const enrichedScanData = { ...scanData, timestamp };
    
    // Mettre à jour les états
    setScanDataState(enrichedScanData);
    setLargestFilesState(files);
    setFoldersState(folders);
    setFileTypeDistributionState(distribution);
    setLastScanTime(timestamp);
    
    // Sauvegarder dans localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.SCAN_DATA, JSON.stringify(enrichedScanData));
      localStorage.setItem(STORAGE_KEYS.LARGEST_FILES, JSON.stringify(files));
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
      localStorage.setItem(STORAGE_KEYS.FILE_TYPE_DISTRIBUTION, JSON.stringify(distribution));
      localStorage.setItem(STORAGE_KEYS.LAST_SCAN_TIME, JSON.stringify(timestamp));
      
      console.log('ScanContext: All data saved successfully to localStorage');
    } catch (error) {
      console.error('ScanContext: Error saving to localStorage:', error);
    }
  };

  const isDataAvailable = scanData !== null && scanData.total_files > 0 && scanData.total_size > 0;
  
  // Debug log pour isDataAvailable
  useEffect(() => {
    console.log('ScanContext: isDataAvailable changed:', {
      isDataAvailable,
      scanData: scanData ? {
        total_files: scanData.total_files,
        total_size: scanData.total_size,
        scan_path: scanData.scan_path,
        timestamp: scanData.timestamp
      } : null,
      lastScanTime: lastScanTime ? new Date(lastScanTime).toLocaleString() : null
    });
  }, [isDataAvailable, scanData, lastScanTime]);

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
