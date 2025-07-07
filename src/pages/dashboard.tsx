import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Folder, ChartPie, BarChart3, Fan, HardDrive, Database, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useToast } from "../components/ui/toast-provider";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState({
    filesAnalyzed: 0,
    totalSize: 0
  });
  const { addToast } = useToast();

  useEffect(() => {
    const unlisten = listen('scan_progress', (event) => {
      setScanStatus(event.payload as any);
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleScanEntireDisk = async () => {
    try {
      setIsScanning(true);
      setScanStatus({ filesAnalyzed: 0, totalSize: 0 });
      await invoke("start_scan", { path: "/" });
      setIsScanning(false);
      setLocation("/scan-results");
      addToast({
        type: 'success',
        title: 'Scan Completed',
        message: 'Disk scan has been completed successfully.'
      });
    } catch (error) {
      console.error('Error scanning disk:', error);
      setIsScanning(false);
      addToast({
        type: 'error',
        title: 'Scan Failed',
        message: 'Failed to scan the disk. Please try again.'
      });
    }
  };

  const handleChooseFolder = async () => {
    try {
      const result = await invoke("select_folder");
      if (result) {
        setIsScanning(true);
        setScanStatus({ filesAnalyzed: 0, totalSize: 0 });
        await invoke("start_scan", { path: result });
        setIsScanning(false);
        setLocation("/scan-results");
        addToast({
          type: 'success',
          title: 'Folder Scan Completed',
          message: 'Selected folder has been scanned successfully.'
        });
      }
    } catch (error) {
      console.error('Error scanning folder:', error);
      setIsScanning(false);
      addToast({
        type: 'error',
        title: 'Scan Failed',
        message: 'Failed to scan the selected folder. Please try again.'
      });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(1) + ' GB';
    } else if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else {
      return bytes + ' bytes';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Analyze Disk Space</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Visualize disk space usage and identify large files to optimize your storage
          and free up valuable space
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4 mb-16">
        <Button
          onClick={handleScanEntireDisk}
          disabled={isScanning}
          className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Search className="w-4 h-4 mr-2" />
          {isScanning ? 'Scanning...' : 'Scan Entire Disk'}
        </Button>
        <Button
          onClick={handleChooseFolder}
          disabled={isScanning}
          variant="outline"
          className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          <Folder className="w-4 h-4 mr-2" />
          Choose Folder
        </Button>
      </div>

      {/* Analysis Status Card */}
      <Card className="mb-12 border-gray-200">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ChartPie className="text-2xl text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {isScanning ? 'Scanning in Progress...' : 'Ready to Analyze'}
            </h3>
            <p className="text-gray-600 mb-6">
              {isScanning
                ? 'Analyzing your disk space usage...'
                : 'Click "Scan Entire Disk" to analyze your complete storage or "Choose Folder" to scan a specific directory'
              }
            </p>
            <div className="flex justify-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span>
                  Files Analyzed: <span className="font-medium">{scanStatus.filesAnalyzed.toLocaleString()}</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-gray-400" />
                <span>
                  Total Size: <span className="font-medium">{formatSize(scanStatus.totalSize)}</span>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="feature-card">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Search className="icon-blue" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Deep Analysis</h3>
          <p className="text-sm text-gray-600">Scan files and folders to identify space usage patterns</p>
        </div>
        <div className="feature-card">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="icon-green" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Visual Reports</h3>
          <p className="text-sm text-gray-600">Interactive charts and graphs for easy understanding</p>
        </div>
        <div className="feature-card">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Fan className="icon-purple" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Space Cleanup</h3>
          <p className="text-sm text-gray-600">Identify large files and folders for easy cleanup</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
