import { useState, useEffect } from "react";
import { Download, RefreshCw, FileText, Database, Folder, HardDrive, ArrowUp, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import CustomDoughnutChart from "../components/charts/doughnut-chart";
import CustomLineChart from "../components/charts/line-chart";
import { invoke } from "@tauri-apps/api/core";

const VisualReports = () => {
  const [scanData, setScanData] = useState<any>(null);
  const [doughnutData, setDoughnutData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [largestFiles, setLargestFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [fileTypeDistribution, setFileTypeDistribution] = useState<any[]>([]);
  useEffect(() => {
    invoke("get_scan_results").then((data) => setScanData(data));
    invoke("get_doughnut_data").then((data) => setDoughnutData(data as any[]));
    invoke("get_trend_data").then((data) => setTrendData(data as any[]));
    invoke("get_largest_files").then((data) => setLargestFiles(data as any[]));
    invoke("get_folders").then((data) => setFolders(data as any[]));
    invoke("get_file_type_distribution").then((data) => setFileTypeDistribution(data as any[]));
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 bytes';
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(1) + ' GB';
    } else if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else if (bytes >= 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return bytes + ' bytes';
    }
  };

  const handleExportReport = async () => {
    try {
      await invoke("export_report");
      console.log('Report exported successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  const handleRefreshData = async () => {
    try {
      const newScanData = await invoke("get_scan_results");
      setScanData(newScanData);
      const newDoughnutData = await invoke("get_doughnut_data");
      setDoughnutData(newDoughnutData as any[]);
      const newTrendData = await invoke("get_trend_data");
      setTrendData(newTrendData as any[]);
      const newLargestFiles = await invoke("get_largest_files");
      setLargestFiles(newLargestFiles as any[]);
      const newFolders = await invoke("get_folders");
      setFolders(newFolders as any[]);
      const newFileTypes = await invoke("get_file_type_distribution");
      setFileTypeDistribution(newFileTypes as any[]);
      console.log('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  if (!scanData) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Visual Reports</h1>
          <p className="text-gray-600">Interactive charts and visualizations of your disk space usage</p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={handleExportReport}
            variant="outline"
            className="bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button
            onClick={handleRefreshData}
            className="bg-black text-white hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <FileText className="icon-blue" />
            <span className="text-sm font-medium text-gray-600">Total Files</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{(scanData.total_files || scanData.totalFiles || 0).toLocaleString()}</div>
          <div className="text-sm text-green-600 flex items-center">
            <ArrowUp className="w-3 h-3 mr-1" />
            +12% from last scan
          </div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Database className="icon-green" />
            <span className="text-sm font-medium text-gray-600">Total Size</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatSize(scanData.total_size || scanData.totalSize || 0)}</div>
          <div className="text-sm text-green-600 flex items-center">
            <ArrowUp className="w-3 h-3 mr-1" />
            +5.2 GB since last scan
          </div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Folder className="icon-yellow" />
            <span className="text-sm font-medium text-gray-600">Largest Folder</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{folders.length > 0 ? folders[0].name : 'N/A'}</div>
          <div className="text-sm text-gray-600">{folders.length > 0 ? formatSize(folders[0].size || folders[0].total_size || 0) : 'N/A'}</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <HardDrive className="icon-purple" />
            <span className="text-sm font-medium text-gray-600">Free Space</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatSize((scanData.total_size || scanData.totalSize || 0) * 0.15)}</div> {/* Placeholder for free space */}
          <div className="text-sm text-gray-600">15.3% remaining</div>
        </Card>
      </div>

      {/* Main Charts Section */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Disk Usage Overview */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Disk Usage Overview</CardTitle>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="text-sm px-3 py-1">
                  Treemap
                </Button>
                <Button size="sm" className="text-sm px-3 py-1 bg-black text-white">
                  Pie Chart
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <CustomDoughnutChart 
                data={doughnutData} 
                height={320}
                centerText={formatSize(scanData.total_size || scanData.totalSize || 0)}
                centerSubText="Used Space"
              />
            </div>
            <div className="mt-4 text-sm text-gray-600 text-center">Interactive pie chart visualization</div>
          </CardContent>
        </Card>

        {/* File Type Distribution */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>File Type Distribution</CardTitle>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fileTypeDistribution.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm font-medium">{item.file_type || item.type}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-900">{formatSize(item.size)}</div>
                      <div className="text-sm text-gray-600">{(((item.size / (scanData.total_size || scanData.totalSize || 1)) * 100) || 0).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="progress-bar w-full mt-2">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${(((item.size / (scanData.total_size || scanData.totalSize || 1)) * 100) || 0).toFixed(1)}%`,
                        backgroundColor: item.color 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Trend and Largest Files */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Usage Trend */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Usage Trend</CardTitle>
              <div className="flex space-x-2 text-sm">
                <Button variant="outline" size="sm">7D</Button>
                <Button size="sm" className="bg-black text-white">30D</Button>
                <Button variant="outline" size="sm">90D</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <CustomLineChart data={trendData} height={256} />
            </div>
            <div className="mt-4 text-sm text-gray-600 text-center">Storage usage over time chart</div>
          </CardContent>
        </Card>

        {/* Largest Files */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Largest Files</CardTitle>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                View All Large Files
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {largestFiles.map((file) => (
                <div key={file.id} className="file-item">
                  <div className="flex items-center space-x-3">
                    <FileText className="icon-blue" />
                    <div>
                      <div className="font-medium text-gray-900">{file.name}</div>
                      <div className="text-sm text-gray-600">{formatSize(file.size)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Folder Breakdown Table */}
      <Card>
        <CardHeader className="border-b border-gray-200">
          <div className="flex justify-between items-center">
            <CardTitle>Folder Breakdown</CardTitle>
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
              <ExternalLink className="w-4 h-4 mr-1" />
              Sort by Size
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folder Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>% of Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((folder) => (
                <TableRow key={folder.id} className="table-hover">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Folder className="icon-yellow" />
                      <span className="font-medium text-gray-900">{folder.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatSize(folder.size || folder.total_size || 0)}</TableCell>
                  <TableCell>{(folder.file_count || folder.fileCount || 0).toLocaleString()}</TableCell>
                  <TableCell>{folder.percentage?.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisualReports;
