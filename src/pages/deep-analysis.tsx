import { useState, useEffect } from "react";
import { ArrowLeft, FileText, Database, Folder, Star, Download, RotateCcw, Filter, ExternalLink, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import CustomPieChart from "../components/charts/pie-chart";
import CustomLineChart from "../components/charts/line-chart";
import FileItem from "../components/file-item";
import { invoke } from "@tauri-apps/api/core";

const DeepAnalysis = () => {
  const [scanData, setScanData] = useState<any>(null);
  const [pieChartData, setPieChartData] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [largestFiles, setLargestFiles] = useState<any[]>([]);
  const [cleanupSuggestions, setCleanupSuggestions] = useState<any[]>([]);
  
  useEffect(() => {
    invoke("get_scan_results").then((data) => setScanData(data));
    invoke("get_pie_chart_data").then((data) => setPieChartData(data as any[]));
    invoke("get_growth_data").then((data) => setGrowthData(data as any[]));
    invoke("get_folders").then((data) => setFolders(data as any[]));
    invoke("get_largest_files").then((data) => setLargestFiles(data as any[]));
    invoke("get_cleanup_suggestions").then((data) => setCleanupSuggestions(data as any[]));
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

  const handleExportReport = () => {
    console.log('Exporting report...');
  };

  const handleRescan = () => {
    console.log('Rescanning...');
  };

  if (!scanData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center space-x-2 text-gray-600 text-sm mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Deep Analysis Report</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Detailed breakdown of disk space usage for {scanData.scan_path}</h1>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <FileText className="icon-blue" />
            <span className="text-sm font-medium text-gray-600">Total Files</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{scanData.total_files.toLocaleString()}</div>
          <div className="text-sm text-gray-600">24.5% from last scan</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Database className="icon-green" />
            <span className="text-sm font-medium text-gray-600">Total Size</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatSize(scanData.total_size)}</div>
          <div className="text-sm text-gray-600">29.7% from last scan</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Folder className="icon-yellow" />
            <span className="text-sm font-medium text-gray-600">Folders</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{scanData.total_folders.toLocaleString()}</div>
          <div className="text-sm text-gray-600">-2.5% from last scan</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <Star className="icon-purple" />
            <span className="text-sm font-medium text-gray-600">Largest File</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{largestFiles.length > 0 ? formatSize(largestFiles[0].size) : 'N/A'}</div>
          <div className="text-sm text-gray-600">{largestFiles.length > 0 ? largestFiles[0].name : 'N/A'}</div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Space Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Space Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <CustomPieChart data={pieChartData} height={256} showLegend={false} />
            </div>
            <div className="mt-4 space-y-2">
              {pieChartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value} GB ({((item.value / pieChartData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Growth Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Growth Trend</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <CustomLineChart data={growthData} height={256} />
            </div>
            <div className="mt-4 text-sm text-gray-600 text-center">Growth Chart (Last 6 Months)</div>
          </CardContent>
        </Card>
      </div>

      {/* Folder Breakdown Table */}
      <Card className="mb-8">
        <CardHeader className="border-b border-gray-200">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <Folder className="w-5 h-5" />
              <span>Folder Breakdown</span>
            </CardTitle>
            <div className="flex space-x-2">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                <Filter className="w-4 h-4 mr-1" />
                Filter
              </Button>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                <ExternalLink className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
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
                  <TableCell>{formatSize(folder.size)}</TableCell>
                  <TableCell>{folder.file_count.toLocaleString()}</TableCell>
                  <TableCell>{folder.percentage?.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom Section */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Large Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Large Files</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {largestFiles.slice(0, 3).map((file) => (
                <FileItem
                  key={file.id}
                  name={file.name}
                  path={file.path}
                  size={file.size}
                  type={file.file_type}
                  extension={file.extension}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cleanup Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="w-5 h-5" />
              <span>Cleanup Suggestions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cleanupSuggestions.map((suggestion, index) => (
                <div key={index} className={`cleanup-suggestion ${suggestion.color_class}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{suggestion.type}</h4>
                    <span className="text-sm font-medium text-blue-600">{suggestion.count} files</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Remove {formatSize(suggestion.size)} of duplicate content</p>
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                    View Duplicates
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4 mt-8">
        <Button
          onClick={handleExportReport}
          className="bg-black text-white hover:bg-gray-800"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
        <Button
          onClick={handleRescan}
          variant="outline"
          className="bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Rescan
        </Button>
      </div>
    </div>
  );
};

export default DeepAnalysis;