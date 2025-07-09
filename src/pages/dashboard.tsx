import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Folder, ChartPie, BarChart3, Fan, HardDrive, Database, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useToast } from "../components/ui/toast-provider";
import { useScanContext } from "../contexts/scan-context";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState({
    filesAnalyzed: 0,
    totalSize: 0,
    currentPath: '',
    progress: 0
  });
  const { addToast } = useToast();
  const { clearAllData, saveScanResults, isDataAvailable, lastScanTime, scanData } = useScanContext();

  // Debug log pour voir l'état des données
  useEffect(() => {
    console.log('Dashboard: Context state changed:', {
      isDataAvailable,
      scanData: scanData ? {
        total_files: scanData.total_files,
        scan_path: scanData.scan_path
      } : null,
      lastScanTime: lastScanTime ? new Date(lastScanTime).toLocaleString() : null
    });
  }, [isDataAvailable, scanData, lastScanTime]);

  useEffect(() => {
    const unlisten = listen('scan_progress', (event) => {
      const payload = event.payload as any;
      // Utiliser directement les propriétés en camelCase du backend
      setScanStatus({
        filesAnalyzed: payload?.filesAnalyzed || 0,
        totalSize: payload?.totalSize || 0,
        currentPath: payload?.currentPath || '',
        progress: payload?.progress || 0
      });
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleScanEntireDisk = async () => {
    try {
      setIsScanning(true);
      setScanStatus({ filesAnalyzed: 0, totalSize: 0, currentPath: '', progress: 0 });
      
      // Nettoyer les données précédentes avant le nouveau scan
      clearAllData();
      
      console.log('Starting disk scan...');
      await invoke("start_scan", { path: "/" });
      console.log('Disk scan completed, fetching results...');
      
      // Récupérer et sauvegarder les résultats du scan
      await fetchAndSaveScanResults();
      
      setIsScanning(false);
      
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
        setScanStatus({ filesAnalyzed: 0, totalSize: 0, currentPath: '', progress: 0 });
        
        // Nettoyer les données précédentes avant le nouveau scan
        clearAllData();
        
        console.log('Starting folder scan for:', result);
        await invoke("start_scan", { path: result });
        console.log('Folder scan completed, fetching results...');
        
        // Récupérer et sauvegarder les résultats du scan
        await fetchAndSaveScanResults();
        
        setIsScanning(false);
        
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

  // Fonction pour récupérer et sauvegarder toutes les données du scan
  const fetchAndSaveScanResults = async () => {
    try {
      console.log('Fetching scan results...');
      
      // Récupérer toutes les données en parallèle
      const [scanData, largestFiles, folders, fileTypeDistribution] = await Promise.all([
        invoke("get_scan_results"),
        invoke("get_largest_files"),
        invoke("get_folders"),
        invoke("get_file_type_distribution")
      ]);

      console.log('Scan data received:', { scanData, largestFiles, folders, fileTypeDistribution });

      // Sauvegarder toutes les données dans le contexte
      saveScanResults(
        scanData as any,
        largestFiles as any,
        folders as any,
        fileTypeDistribution as any
      );

      console.log('Scan data saved successfully');
      
      // Forcer une re-évaluation en attendant un tick
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Error fetching scan results:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to retrieve scan results.'
      });
      throw error; // Re-throw pour que l'appelant puisse gérer l'erreur
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

      {/* Data Status Section */}
      {isDataAvailable && (
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <Database className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-green-900">Scan Data Available</h3>
                  <p className="text-sm text-green-700">
                    Last scan: {lastScanTime ? new Date(lastScanTime).toLocaleString() : 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setLocation('/scan-results')}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  View Results
                </Button>
                <Button
                  onClick={clearAllData}
                  size="sm"
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  Clear Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information sur la persistance */}
      {!isDataAvailable && (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-blue-900 mb-2">Data Persistence</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Your scan results are automatically saved and will remain available across sessions. 
                  You can run a new scan at any time to refresh the data.
                </p>
                <div className="text-xs text-blue-600">
                  • Run "Scan Entire Disk" to analyze your complete storage<br/>
                  • Use "Choose Folder" to scan a specific directory<br/>
                  • Data persists until you clear it or run a new scan
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                ? `Analyzing your disk space usage... ${scanStatus.currentPath ? `Currently scanning: ${scanStatus.currentPath}` : ''}`
                : 'Click "Scan Entire Disk" to analyze your complete storage or "Choose Folder" to scan a specific directory'
              }
            </p>
            
            {/* Barre de progression */}
            {isScanning && (
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanStatus.progress || 0}%` }}
                  />
                </div>
                <div className="text-sm text-gray-500 text-center">
                  {scanStatus.progress ? `${scanStatus.progress.toFixed(1)}% complete` : 'Initializing scan...'}
                </div>
              </div>
            )}
            
            <div className="flex justify-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span>
                  Files Analyzed: <span className="font-medium">{(scanStatus?.filesAnalyzed || 0).toLocaleString()}</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-gray-400" />
                <span>
                  Total Size: <span className="font-medium">{formatSize(scanStatus?.totalSize || 0)}</span>
                </span>
              </div>
              {isScanning && scanStatus.currentPath && (
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-600 font-medium">
                    Scanning...
                  </span>
                </div>
              )}
            </div>
            
            {/* Informations supplémentaires pendant le scan */}
            {isScanning && scanStatus.currentPath && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-700 truncate">
                  📂 {scanStatus.currentPath}
                </div>
              </div>
            )}
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
