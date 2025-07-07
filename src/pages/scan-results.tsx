import { useState, useEffect } from "react";
import { RotateCcw, HardDrive, Folder, Database, Clock, List } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import FileItem from "../components/file-item";
import FolderItem from "../components/folder-item";
import { invoke } from "@tauri-apps/api/core";

const ScanResults = () => {
  const [scanData, setScanData] = useState<any>(null);
  const [largestFiles, setLargestFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [fileTypeDistribution, setFileTypeDistribution] = useState<any[]>([]);

  useEffect(() => {
    invoke("get_scan_results").then((data) => setScanData(data));
    invoke("get_largest_files").then((data) => setLargestFiles(data as any[]));
    invoke("get_folders").then((data) => setFolders(data as any[]));
    invoke("get_file_type_distribution").then((data) => setFileTypeDistribution(data as any[]));
  }, []);

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
      const scanPath = scanData?.scan_path || scanData?.scanPath;
      if (scanPath) {
        await invoke("start_scan", { path: scanPath });
        // Refresh data after scan
        const newScanData = await invoke("get_scan_results");
        setScanData(newScanData);
        const newLargestFiles = await invoke("get_largest_files");
        setLargestFiles(newLargestFiles as any[]);
        const newFolders = await invoke("get_folders");
        setFolders(newFolders as any[]);
        const newFileTypes = await invoke("get_file_type_distribution");
        setFileTypeDistribution(newFileTypes as any[]);
      }
    } catch (error) {
      console.error("Error rescanning:", error);
    }
  };

  if (!scanData) {
    return <div>Loading...</div>;
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
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Rescan
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
            <CardTitle className="flex items-center space-x-2">
              <List className="w-5 h-5" />
              <span>Largest Files</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {largestFiles.map((file) => (
                <FileItem
                  key={file.id}
                  name={file.name}
                  path={file.path}
                  size={file.size}
                  type={file.type}
                  extension={file.extension}
                />
              ))}
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
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
              <List className="w-4 h-4 mr-1" />
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {folders.map((folder) => (
              <FolderItem
                key={folder.id}
                name={folder.name}
                size={folder.total_size || folder.totalSize || folder.size}
                fileCount={folder.file_count || folder.fileCount}
                percentage={folder.percentage}
                showProgress={true}
              />
            ))}
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
    </div>
  );
};

export default ScanResults;
