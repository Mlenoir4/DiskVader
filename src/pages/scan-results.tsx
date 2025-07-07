import { useState, useEffect } from "react";
import { RotateCcw, HardDrive, Folder, Database, Clock, List, Loader2, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import FileItem from "../components/file-item";
import FolderItem from "../components/folder-item";
import { useToast } from "../components/ui/toast-provider";
import { invoke } from "@tauri-apps/api/core";

const ScanResults = () => {
  const [scanData, setScanData] = useState<any>(null);
  const [largestFiles, setLargestFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [fileTypeDistribution, setFileTypeDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [foldersModalOpen, setFoldersModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [scanResults, filesResults, foldersResults, fileTypesResults] = await Promise.all([
          invoke("get_scan_results"),
          invoke("get_largest_files"),
          invoke("get_folders"),
          invoke("get_file_type_distribution")
        ]);
        
        setScanData(scanResults);
        setLargestFiles(filesResults as any[]);
        setFolders(foldersResults as any[]);
        setFileTypeDistribution(fileTypesResults as any[]);
      } catch (error) {
        console.error('Error loading data:', error);
        addToast({
          type: 'error',
          title: 'Error Loading Data',
          message: 'Failed to load scan results.'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [addToast]);

  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(1) + ' GB';
    } else if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else {
      return bytes + ' bytes';
    }
  };

  const handleRescan = async () => {
    try {
      setRescanning(true);
      const scanPath = scanData?.scan_path || scanData?.scanPath;
      if (scanPath) {
        await invoke("start_scan", { path: scanPath });
        
        // Refresh data after scan
        const [newScanData, newLargestFiles, newFolders, newFileTypes] = await Promise.all([
          invoke("get_scan_results"),
          invoke("get_largest_files"),
          invoke("get_folders"),
          invoke("get_file_type_distribution")
        ]);
        
        setScanData(newScanData);
        setLargestFiles(newLargestFiles as any[]);
        setFolders(newFolders as any[]);
        setFileTypeDistribution(newFileTypes as any[]);
        
        addToast({
          type: 'success',
          title: 'Rescan Completed',
          message: 'Data has been refreshed successfully.'
        });
      }
    } catch (error) {
      console.error("Error rescanning:", error);
      addToast({
        type: 'error',
        title: 'Rescan Failed',
        message: 'Failed to rescan. Please try again.'
      });
    } finally {
      setRescanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading scan results...</p>
        </div>
      </div>
    );
  }

  if (!scanData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">No scan data available</p>
          <Button onClick={() => window.location.href = '/'} className="mt-4">
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
          <p className="text-gray-600">Analysis completed for {scanData.scan_path || scanData.scanPath}</p>
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
          <div className="text-2xl font-bold text-gray-900">{(scanData.total_files || scanData.totalFiles || 0).toLocaleString()}</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Folder className="icon-yellow" />
            <span className="text-sm font-medium text-gray-600">Total Folders</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{(scanData.total_folders || scanData.totalFolders || 0).toLocaleString()}</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Database className="icon-green" />
            <span className="text-sm font-medium text-gray-600">Total Size</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatSize(scanData.total_size || scanData.totalSize || 0)}</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="icon-purple" />
            <span className="text-sm font-medium text-gray-600">Scan Time</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{scanData.scan_time || scanData.scanTime || 0}s</div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Space Usage Visualization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HardDrive className="w-5 h-5" />
              <span>Space Usage Visualization</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-container">
              <div className="treemap-mockup">
                <div className="treemap-item blue">Videos</div>
                <div className="treemap-item green">Images</div>
                <div className="treemap-item yellow">Docs</div>
                <div className="treemap-item purple col-span-2">Other</div>
                <div className="treemap-item gray">Cache</div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4 text-center">Interactive Treemap View</p>
          </CardContent>
        </Card>

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
            <div className="space-y-3">
              {largestFiles.slice(0, 5).map((file) => (
                <FileItem
                  key={file.id}
                  name={file.name}
                  path={file.path}
                  size={file.size}
                  type={file.type}
                  extension={file.extension}
                />
              ))}
              {largestFiles.length > 5 && (
                <div className="text-center pt-3">
                  <p className="text-sm text-gray-500">
                    Showing 5 of {largestFiles.length} files
                  </p>
                </div>
              )}
            </div>
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
            >
              <List className="w-4 h-4 mr-1" />
              View All Folders
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {folders.slice(0, 5).map((folder) => (
              <FolderItem
                key={folder.id}
                name={folder.name}
                size={folder.total_size || folder.totalSize || folder.size}
                fileCount={folder.file_count || folder.fileCount}
                percentage={folder.percentage}
                showProgress={true}
              />
            ))}
            {folders.length > 5 && (
              <div className="text-center pt-3">
                <p className="text-sm text-gray-500">
                  Showing 5 of {folders.length} folders
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File Types Distribution */}
      <Card>
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5" />
            <span>File Types Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {fileTypeDistribution.map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <div className="text-xl" style={{ color: item.color }}>
                    {item.type === 'Video Files' && '🎬'}
                    {item.type === 'Images' && '🖼️'}
                    {item.type === 'Documents' && '📄'}
                    {item.type === 'Archives' && '📦'}
                  </div>
                </div>
                <div className="font-medium text-gray-900">{item.type}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{formatSize(item.size)}</div>
                <div className="text-sm text-gray-600">{item.count.toLocaleString()} files</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal pour tous les dossiers */}
      <AllFoldersModal
        isOpen={foldersModalOpen}
        onClose={() => setFoldersModalOpen(false)}
        folders={folders}
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

// Composant modal pour tous les dossiers
const AllFoldersModal = ({ 
  isOpen, 
  onClose, 
  folders 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  folders: any[]; 
}) => {
  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(1) + ' GB';
    } else if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else {
      return bytes + ' bytes';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">All Folders</h2>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
        
        <div className="space-y-4">
          {folders.map((folder) => (
            <div key={folder.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Folder className="icon-yellow" />
                  <span className="font-medium">{folder.name}</span>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-sm font-medium">{formatSize(folder.total_size || folder.totalSize || folder.size)}</div>
                  <div className="text-sm text-gray-600">
                    {(folder.file_count || folder.fileCount || 0).toLocaleString()} files
                  </div>
                  <div className="text-sm text-gray-600">
                    {folder.percentage?.toFixed(1)}%
                  </div>
                </div>
              </div>
              {folder.percentage && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-blue-500 transition-all duration-300" 
                    style={{ width: `${folder.percentage}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
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
  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(1) + ' GB';
    } else if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else {
      return bytes + ' bytes';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">All Large Files</h2>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
        
        <div className="space-y-4">
          {files.map((file) => (
            <div key={file.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="icon-blue" />
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-gray-600">{file.path}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-sm font-medium">{formatSize(file.size)}</div>
                  <div className="text-sm text-gray-600">{file.type}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScanResults;
