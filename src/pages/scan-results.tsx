import { useState, useEffect } from "react";
import { RotateCcw, HardDrive, Folder, Database, Clock, List, Loader2, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import FileItem from "../components/file-item";
import FolderItem from "../components/folder-item";
import { useToast } from "../components/ui/toast-provider";
import { useScanContext } from "../contexts/scan-context";
import { useLocation } from "wouter";
import { invoke } from "@tauri-apps/api/core";
import EnhancedFoldersModal from "../components/ui/enhanced-folders-modal";
import UnifiedDistributionChart from "../components/charts/unified-distribution-chart";

const ScanResults = () => {
  const [loading, setLoading] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [foldersModalOpen, setFoldersModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [doughnutData, setDoughnutData] = useState<any[]>([]);
  const { addToast } = useToast();
  const [, setLocation] = useLocation();
  
  // Utiliser les données du contexte
  const { 
    scanData, 
    largestFiles, 
    folders, 
    fileTypeDistribution, 
    isDataAvailable,
    clearAllData,
    saveScanResults 
  } = useScanContext();

  // Rediriger vers le dashboard si aucune donnée n'est disponible
  useEffect(() => {
    if (!isDataAvailable && !loading) {
      addToast({
        type: 'info',
        title: 'No Data Available',
        message: 'Please run a scan first to view results.'
      });
      setLocation('/');
    }
  }, [isDataAvailable, loading, addToast, setLocation]);

  const formatSize = (bytes: number) => {
    if (bytes >= 1099511627776) { // 1TB
      return (bytes / 1099511627776).toFixed(2) + ' TB';
    } else if (bytes >= 1073741824) { // 1GB
      return (bytes / 1073741824).toFixed(2) + ' GB';
    } else if (bytes >= 1048576) { // 1MB
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else if (bytes >= 1024) { // 1KB
      return (bytes / 1024).toFixed(0) + ' KB';
    } else {
      return bytes + ' bytes';
    }
  };

  const formatSizeInGB = (bytes: number) => {
    return (bytes / 1073741824).toFixed(2) + ' GB';
  };

  // Fonction pour obtenir l'icône appropriée pour chaque type de fichier
  const getFileTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('video')) return '🎬';
    if (lowerType.includes('image')) return '🖼️';
    if (lowerType.includes('document')) return '📄';
    if (lowerType.includes('archive')) return '📦';
    if (lowerType.includes('audio')) return '🎵';
    if (lowerType.includes('application')) return '⚙️';
    if (lowerType.includes('other')) return '📁';
    return '📄'; // Icône par défaut
  };

  const handleRescan = async () => {
    try {
      setRescanning(true);
      const scanPath = scanData?.scan_path;
      if (scanPath) {
        // Nettoyer les données existantes
        clearAllData();
        
        await invoke("start_scan", { path: scanPath });
        
        // Refresh data after scan
        const [newScanData, newLargestFiles, newFolders, newFileTypes] = await Promise.all([
          invoke("get_scan_results"),
          invoke("get_largest_files"),
          invoke("get_folders"),
          invoke("get_file_type_distribution")
        ]);
        
        // Sauvegarder les nouvelles données
        saveScanResults(
          newScanData as any,
          newLargestFiles as any,
          newFolders as any,
          newFileTypes as any
        );
        
        addToast({
          type: 'success',
          title: 'Rescan Completed',
          message: 'Data has been refreshed successfully.'
        });
      }
    } catch (error: any) {
      console.error("Error rescanning:", error);
      const errorMessage = error.message || 'Failed to rescan. Please try again.';
      addToast({
        type: 'error',
        title: 'Rescan Failed',
        message: errorMessage
      });
    } finally {
      setRescanning(false);
    }
  };

  // Charger les données pour le graphique doughnut
  useEffect(() => {
    const loadDoughnutData = async () => {
      if (!isDataAvailable) return;
      
      try {
        const doughnutResults = await invoke("get_doughnut_data");
        setDoughnutData(doughnutResults as any[]);
      } catch (error) {
        console.error('Error loading doughnut data:', error);
      }
    };

    loadDoughnutData();
  }, [isDataAvailable]);

  // Adapter les données pour le composant unifié
  const adaptFileTypeData = () => {
    if (!fileTypeDistribution || !Array.isArray(fileTypeDistribution)) return [];
    
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444',
      '#6B7280', '#F97316', '#EC4899', '#14B8A6', '#84CC16'
    ];
    
    return fileTypeDistribution.map((item, index) => ({
      name: item.type,
      type: item.type,
      size: item.size,
      count: item.count,
      color: item.color || colors[index % colors.length]
    }));
  };

  const adaptFolderData = () => {
    if (!folders || !Array.isArray(folders)) return [];
    
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444',
      '#6B7280', '#F97316', '#EC4899', '#14B8A6', '#84CC16'
    ];
    
    return folders.map((folder, index) => ({
      name: folder.name,
      size: folder.size || 0,
      count: folder.file_count,
      color: colors[index % colors.length]
    }));
  };

  if (!isDataAvailable || !scanData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">No scan data available</p>
          <Button onClick={() => setLocation('/')} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Scan Results</h1>
          <p className="text-gray-600">Analysis completed for {scanData?.scan_path}</p>
        </div>
        <Button
          onClick={handleRescan}
          className="bg-black text-white hover:bg-gray-800"
          disabled={rescanning}
        >
          {rescanning ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4 mr-2" />
          )}
          {rescanning ? 'Rescanning...' : 'Rescan'}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <HardDrive className="icon-blue" />
            <span className="text-sm font-medium text-gray-600">Total Files</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{(scanData?.total_files || 0).toLocaleString()}</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Folder className="icon-yellow" />
            <span className="text-sm font-medium text-gray-600">Total Folders</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{(scanData?.total_folders || 0).toLocaleString()}</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Database className="icon-green" />
            <span className="text-sm font-medium text-gray-600">Total Size</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatSize(scanData?.total_size || 0)}</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="icon-purple" />
            <span className="text-sm font-medium text-gray-600">Scan Time</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{(scanData?.scan_time || 0).toFixed(2)}s</div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Data Distribution - Unified Component */}
        <UnifiedDistributionChart
          fileTypeData={adaptFileTypeData()}
          folderData={adaptFolderData()}
          doughnutData={doughnutData}
          totalSize={scanData?.total_size || 0}
          title="Data Distribution"
          showDataSelector={true}
          showViewSelector={true}
          defaultDataType="fileTypes"
          defaultViewType="list"
          isLoading={loading || rescanning}
        />

        {/* Largest Files */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center space-x-2">
                <List className="w-5 h-5" />
                <span>Largest Files</span>
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-blue-600 hover:text-blue-800"
                onClick={() => setFilesModalOpen(true)}
              >
                <List className="w-4 h-4 mr-1" />
                View All Files
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <LargestFilesPreview />
          </CardContent>
        </Card>
      </div>

      {/* Folder Breakdown */}
      <Card className="mb-8">
        <CardHeader className="border-b border-gray-200">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <Folder className="w-5 h-5" />
              <span>Folder Breakdown</span>
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-600 hover:text-blue-800"
              onClick={() => setFoldersModalOpen(true)}
              disabled={!folders || folders.length === 0}
            >
              <List className="w-4 h-4 mr-1" />
              View All Folders
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {folders && folders.length > 0 ? (
              folders.slice(0, 5).map((folder) => (
                <FolderItem
                  key={folder.id}
                  name={folder.name}
                  size={folder.size}
                  fileCount={folder.file_count}
                  percentage={folder.percentage}
                  showProgress={true}
                />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No folder data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal pour tous les dossiers avec fichiers */}
      <EnhancedFoldersModal
        isOpen={foldersModalOpen}
        onClose={() => setFoldersModalOpen(false)}
        folders={folders || []}
      />

      {/* Modal pour tous les fichiers */}
      <AllFilesModal
        isOpen={filesModalOpen}
        onClose={() => setFilesModalOpen(false)}
        files={largestFiles}
      />
    </div>
  );
};

// Composant modal pour tous les fichiers
const AllFilesModal = ({ 
  isOpen, 
  onClose, 
  files 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  files: any[]; 
}) => {
  const [allFiles, setAllFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'size' | 'name' | 'type'>('size');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Accéder aux données du contexte pour avoir le nombre total de fichiers
  const { scanData } = useScanContext();

  const formatSize = (bytes: number) => {
    if (bytes >= 1099511627776) { // 1TB
      return (bytes / 1099511627776).toFixed(2) + ' TB';
    } else if (bytes >= 1073741824) { // 1GB
      return (bytes / 1073741824).toFixed(2) + ' GB';
    } else if (bytes >= 1048576) { // 1MB
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else if (bytes >= 1024) { // 1KB
      return (bytes / 1024).toFixed(0) + ' KB';
    } else {
      return bytes + ' bytes';
    }
  };

  // Charger tous les fichiers quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      loadAllFiles();
    }
  }, [isOpen]);

  const loadAllFiles = async () => {
    try {
      setLoading(true);
      
      // Essayer plusieurs approches pour obtenir plus de fichiers
      let allFilesData: any[] = [];
      
      try {
        // 1. D'abord essayer get_largest_files
        const largestFiles = await invoke('get_largest_files') as any[];
        console.log(`Step 1: Loaded ${largestFiles.length} from get_largest_files`);
        allFilesData = [...largestFiles];
        
        // 2. Si on n'a pas assez de fichiers, essayer de récupérer par dossiers
        if (allFilesData.length < 50) {
          try {
            const folders = await invoke('get_folders') as any[];
            console.log(`Step 2: Found ${folders.length} folders to explore`);
            
            for (const folder of folders.slice(0, 10)) { // Explorer les 10 premiers dossiers
              try {
                const folderFiles = await invoke('get_folder_files', { 
                  folderPath: folder.path || folder.name || ''
                }) as any[];
                
                if (folderFiles && folderFiles.length > 0) {
                  allFilesData = [...allFilesData, ...folderFiles];
                  console.log(`Added ${folderFiles.length} files from folder: ${folder.name}`);
                  
                  // Arrêter si on a déjà beaucoup de fichiers pour éviter les performances
                  if (allFilesData.length > 500) {
                    console.log('Stopping folder exploration, enough files collected');
                    break;
                  }
                }
              } catch (folderError) {
                console.warn(`Error loading files from folder ${folder.name}:`, folderError);
              }
            }
          } catch (foldersError) {
            console.warn('Could not get folders for file exploration:', foldersError);
          }
        }
        
        // 3. Si on n'a toujours pas assez, essayer une approche alternative
        if (allFilesData.length < 20) {
          try {
            // Essayer d'autres APIs si elles existent
            const alternativeFiles = await invoke('get_all_files') as any[];
            console.log(`Step 3: Alternative approach found ${alternativeFiles.length} files`);
            allFilesData = [...allFilesData, ...alternativeFiles];
          } catch (altError) {
            console.log('Alternative file loading method not available:', altError);
          }
        }
        
      } catch (error) {
        console.error('Primary file loading failed:', error);
        
        // Fallback final : utiliser les fichiers du contexte
        if (files && files.length > 0) {
          allFilesData = [...files];
          console.log(`Fallback: Using ${files.length} files from context`);
        }
      }
      
      // Supprimer les doublons basés sur le chemin complet
      const uniqueFiles = allFilesData.filter((file, index, self) => 
        index === self.findIndex(f => 
          f.path === file.path && f.name === file.name
        )
      );
      
      // Trier par taille décroissante et limiter à 100
      const sortedAndLimited = uniqueFiles
        .filter(file => file.size && file.size > 0) // Filtrer les fichiers avec une taille valide
        .sort((a, b) => b.size - a.size)
        .slice(0, 100);
      
      console.log(`Final result: ${sortedAndLimited.length} files (from ${uniqueFiles.length} unique, ${allFilesData.length} total)`);
      setAllFiles(sortedAndLimited);
      
    } catch (error: any) {
      console.error('Error loading files:', error);
      addToast({
        type: 'error',
        title: 'File Loading Failed',
        message: error.message || 'Failed to load all files.'
      });
      // Dernier recours
      setAllFiles(files?.slice(0, 100) || []);
    } finally {
      setLoading(false);
    }
  };

  // Fonction de tri optimisée
  const sortedFiles = [...allFiles].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'type':
        comparison = (a.type || '').localeCompare(b.type || '');
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const handleSort = (newSortBy: 'size' | 'name' | 'type') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Largest Files</h2>
            <p className="text-sm text-gray-600">
              {loading 
                ? 'Loading files from scan...' 
                : `Showing ${sortedFiles.length.toLocaleString()} largest files${scanData?.total_files ? ` (from ${scanData.total_files.toLocaleString()} total files in scan)` : ''}`
              }
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
        
        {/* Options de tri */}
        <div className="mb-4">
          <div className="flex space-x-2 mb-2">
            <Button
              variant={sortBy === 'size' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('size')}
            >
              By Size {sortBy === 'size' && (sortOrder === 'desc' ? '↓' : '↑')}
            </Button>
            <Button
              variant={sortBy === 'name' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('name')}
            >
              By Name {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
            </Button>
            <Button
              variant={sortBy === 'type' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('type')}
            >
              By Type {sortBy === 'type' && (sortOrder === 'desc' ? '↓' : '↑')}
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
              <div className="space-y-2">
                <p className="text-gray-600">Loading files from scan...</p>
                <p className="text-xs text-gray-500">Exploring multiple sources to find your largest files</p>
              </div>
            </div>
          ) : sortedFiles && sortedFiles.length > 0 ? (
            sortedFiles.map((file, index) => (
              <div key={file.id || index} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <FileText className="icon-blue flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-sm text-gray-600 truncate" title={file.path}>
                        {file.path}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 flex-shrink-0">
                    <div className="text-sm font-medium">{formatSize(file.size)}</div>
                    <div className="text-sm text-gray-600 min-w-[80px]">
                      <span className="px-2 py-1 text-xs bg-gray-100 rounded-full">
                        {file.type || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No files available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Composant pour afficher un aperçu des plus gros fichiers
const LargestFilesPreview = () => {
  const [topFiles, setTopFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopFiles();
  }, []);

  const loadTopFiles = async () => {
    try {
      setLoading(true);
      
      // Utiliser directement get_largest_files pour les performances
      let topFilesData: any[] = [];
      try {
        topFilesData = await invoke('get_largest_files') as any[];
        console.log(`LargestFilesPreview: Loaded ${topFilesData.length} largest files`);
        
        // Prendre seulement les 5 premiers pour l'aperçu
        topFilesData = topFilesData.slice(0, 5);
        
      } catch (error) {
        console.error('get_largest_files failed in preview:', error);
        topFilesData = [];
      }
      
      console.log(`LargestFilesPreview: Top 5 largest files selected`);
      setTopFiles(topFilesData);
      
    } catch (error) {
      console.error('Error loading top files:', error);
      setTopFiles([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
        <p className="text-sm text-gray-600">Loading largest files...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topFiles && topFiles.length > 0 ? (
        topFiles.map((file, index) => (
          <FileItem
            key={file.id || index}
            name={file.name}
            path={file.path}
            size={file.size}
            type={file.type}
            extension={file.extension}
          />
        ))
      ) : (
        <div className="text-center py-8 text-gray-500">
          No large files found
        </div>
      )}
    </div>
  );
};

export default ScanResults;
