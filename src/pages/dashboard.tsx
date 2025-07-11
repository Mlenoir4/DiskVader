import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Folder, ChartPie, BarChart3, Fan, HardDrive, Database, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useToast } from "../components/ui/toast-provider";
import { useScanContext } from "../contexts/scan-context";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState({
    filesAnalyzed: 0,
    totalSize: 0,
    foldersAnalyzed: 0,
    currentPath: '',
    progress: 0,
    isActive: false
  });
  const [displayStats, setDisplayStats] = useState({
    filesAnalyzed: 0,
    totalSize: 0,
    foldersAnalyzed: 0,
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

  // Debug log pour les stats en temps réel
  useEffect(() => {
    console.log('📊 [DISPLAY] Stats updated:', {
      isScanning,
      displayStats: {
        filesAnalyzed: displayStats.filesAnalyzed,
        foldersAnalyzed: displayStats.foldersAnalyzed,
        totalSize: displayStats.totalSize,
        progress: displayStats.progress.toFixed(1) + '%',
        currentPath: displayStats.currentPath
      }
    });
  }, [displayStats, isScanning]);

  useEffect(() => {
    const unlisten = listen('scan_progress', (event) => {
      const payload = event.payload as any;
      console.log('🔄 [REAL-TIME] Scan progress received:', {
        filesAnalyzed: payload?.filesAnalyzed,
        totalSize: payload?.totalSize,
        foldersAnalyzed: payload?.foldersAnalyzed,
        currentPath: payload?.currentPath,
        progressPercentage: payload?.progressPercentage,
        estimatedTotalSize: payload?.estimatedTotalSize,
        timestamp: new Date().toLocaleTimeString()
      });
      
      const filesAnalyzed = payload?.filesAnalyzed || 0;
      const foldersAnalyzed = payload?.foldersAnalyzed || 0;
      const totalSize = payload?.totalSize || 0;
      const currentPath = payload?.currentPath || '';
      const progressPercentage = payload?.progressPercentage || 0;
      
      const newScanStatus = {
        filesAnalyzed,
        totalSize,
        foldersAnalyzed,
        currentPath,
        progress: progressPercentage,
        isActive: true
      };
      
      setScanStatus(newScanStatus);
      
      // Mettre à jour IMMEDIATEMENT les stats d'affichage
      setDisplayStats({
        filesAnalyzed,
        totalSize,
        foldersAnalyzed,
        currentPath,
        progress: progressPercentage
      });
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  // Animation fluide pour les stats affichées - SUPPRIMÉ pour affichage immédiat

  const handleScanEntireDisk = async () => {
    try {
      const homePath = await homeDir();
      if (!homePath) {
        addToast({
          type: 'error',
          title: 'Scan Failed',
          message: 'Could not determine the home directory.'
        });
        return;
      }

      setIsScanning(true);
      setScanStatus({ filesAnalyzed: 0, totalSize: 0, foldersAnalyzed: 0, currentPath: '', progress: 0, isActive: true });
      setDisplayStats({ filesAnalyzed: 0, totalSize: 0, foldersAnalyzed: 0, currentPath: '', progress: 0 });
      
      clearAllData();
      
      console.log(`Starting disk scan on home directory: ${homePath}`);
      await invoke("start_scan", { path: homePath });
      console.log('Disk scan completed, fetching results...');
      
      await fetchAndSaveScanResults();
      
      setIsScanning(false);
      setScanStatus(prev => ({ ...prev, isActive: false }));
      
      addToast({
        type: 'success',
        title: 'Scan Completed',
        message: 'Disk scan has been completed successfully.'
      });
      
    } catch (error: any) {
      console.error('Error scanning disk:', error);
      setIsScanning(false);
      setScanStatus(prev => ({ ...prev, isActive: false }));
      const errorMessage = error.message || 'Failed to scan the disk. Please try again.';
      addToast({
        type: 'error',
        title: 'Scan Failed',
        message: errorMessage
      });
    }
  };

  const handleChooseFolder = async () => {
    try {
      const result = await invoke("select_folder");
      if (result) {
        setIsScanning(true);  
        setScanStatus({ filesAnalyzed: 0, totalSize: 0, foldersAnalyzed: 0, currentPath: '', progress: 0, isActive: true });
        setDisplayStats({ filesAnalyzed: 0, totalSize: 0, foldersAnalyzed: 0, currentPath: '', progress: 0 });
        
        // Nettoyer les données précédentes avant le nouveau scan
        clearAllData();
        
        console.log('Starting folder scan for:', result);
        await invoke("start_scan", { path: result });
        console.log('Folder scan completed, fetching results...');
        
        // Récupérer et sauvegarder les résultats du scan
        await fetchAndSaveScanResults();
        
        setIsScanning(false);
        setScanStatus(prev => ({ ...prev, isActive: false }));
        
        addToast({
          type: 'success',
          title: 'Folder Scan Completed',
          message: 'Selected folder has been scanned successfully.'
        });
        
      }
    } catch (error) {
      console.error('Error scanning folder:', error);
      setIsScanning(false);
      setScanStatus(prev => ({ ...prev, isActive: false }));
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
      console.log('Dashboard: Fetching scan results...');
      
      // Récupérer toutes les données en parallèle
      const [scanData, largestFiles, folders, fileTypeDistribution] = await Promise.all([
        invoke("get_scan_results"),
        invoke("get_largest_files"),
        invoke("get_folders"),
        invoke("get_file_type_distribution")
      ]);

      console.log('Dashboard: Scan data received:', { 
        scanData: scanData ? {
          total_files: (scanData as any)?.total_files,
          total_size: (scanData as any)?.total_size,
          scan_path: (scanData as any)?.scan_path
        } : null,
        largestFilesCount: (largestFiles as any)?.length || 0,
        foldersCount: (folders as any)?.length || 0,
        fileTypeDistributionCount: (fileTypeDistribution as any)?.length || 0
      });

      // Vérifier que nous avons des données valides
      if (!scanData || (scanData as any).total_files === 0) {
        console.warn('Dashboard: No valid scan data received');
        return;
      }

      // Sauvegarder toutes les données dans le contexte
      saveScanResults(
        scanData as any,
        largestFiles as any,
        folders as any,
        fileTypeDistribution as any
      );

      console.log('Dashboard: Scan data saved successfully');
      
      // Forcer une re-évaluation en attendant un tick
      await new Promise(resolve => setTimeout(resolve, 200));
      
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

  const handleCancelScan = async () => {
    try {
      await invoke("cancel_scan");
      setIsScanning(false);
      setScanStatus(prev => ({ ...prev, isActive: false }));
      setDisplayStats(prev => ({ ...prev, progress: 0 }));
      addToast({
        type: 'info',
        title: 'Scan Cancelled',
        message: 'The disk scan has been cancelled.'
      });
    } catch (error: any) {
      console.error('Error cancelling scan:', error);
      addToast({
        type: 'error',
        title: 'Cancellation Failed',
        message: error.message || 'Failed to cancel the scan.'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Styles CSS pour les animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes wave {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
            100% { transform: translateX(100%); }
          }
          
          @keyframes countUp {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .animate-countUp {
            animation: countUp 0.3s ease-out;
          }
          
          .wave-animation {
            animation: wave 2s ease-in-out infinite;
          }
        `
      }} />
      
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Analyze Disk Space</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Visualize disk space usage and identify large files to optimize your storage
          and free up valuable space
        </p>
      </div>

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
          {isScanning ? 'Scanning...' : 'Scan Entire Disk'}
        </Button>
        <Button
          onClick={handleChooseFolder}
          disabled={isScanning}
          variant="outline"
          className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          <Folder className="w-4 h-4 mr-2" />
          {isScanning ? 'Scanning...' : 'Choose Folder'}
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
              {isScanning ? 'Scanning in Progress...' : isDataAvailable ? 'Previous Scan Available' : 'Ready to Analyze'}
            </h3>
            <p className="text-gray-600 mb-6">
              {isScanning
                ? `Analyzing your disk space usage... ${scanStatus.currentPath ? `Currently scanning: ${scanStatus.currentPath}` : ''}`
                : isDataAvailable 
                  ? `Scan data from ${lastScanTime ? new Date(lastScanTime).toLocaleString() : 'previous session'} is available. View results or run a new scan to refresh the data.`
                  : 'Click "Scan Entire Disk" to analyze your complete storage or "Choose Folder" to scan a specific directory'
              }
            </p>
            
            {/* Barre de progression */}
            {isScanning && (
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full relative"
                    style={{ 
                      width: `${displayStats.progress || 0}%`,
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    {/* Animation de brillance */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                    {/* Effet de vague */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-300 to-transparent opacity-20 wave-animation"
                         style={{ 
                           transform: 'translateX(-100%)'
                         }}></div>
                  </div>
                </div>
                <div className="text-sm text-gray-500 text-center mb-4">
                  {displayStats.progress ? `${displayStats.progress.toFixed(1)}% complete` : 'Initializing scan...'}
                  {(displayStats.filesAnalyzed > 0 || displayStats.foldersAnalyzed > 0) && (
                    <span className="ml-2 text-blue-600 font-medium">
                      ({displayStats.filesAnalyzed.toLocaleString()} files, {displayStats.foldersAnalyzed.toLocaleString()} folders processed)
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleCancelScan}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 border-red-300"
                >
                  Cancel Scan
                </Button>
              </div>
            )}
            
            <div className="flex justify-center space-x-8 text-sm text-gray-500 mb-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span>
                  Files: <span className="font-medium animate-countUp">
                    {isScanning 
                      ? displayStats.filesAnalyzed.toLocaleString()
                      : isDataAvailable && scanData
                        ? (scanData.total_files || 0).toLocaleString()
                        : '0'
                    }
                  </span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Folder className="w-4 h-4 text-gray-400" />
                <span>
                  Folders: <span className="font-medium animate-countUp">
                    {isScanning 
                      ? displayStats.foldersAnalyzed.toLocaleString()
                      : isDataAvailable && scanData
                        ? (scanData.total_folders || 0).toLocaleString()
                        : '0'
                    }
                  </span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-gray-400" />
                <span>
                  Size: <span className="font-medium animate-countUp">
                    {isScanning 
                      ? formatSize(displayStats.totalSize)
                      : isDataAvailable && scanData
                        ? formatSize(scanData.total_size || 0)
                        : '0 bytes'
                    }
                  </span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {isScanning && scanStatus.isActive ? (
                  <>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-blue-600 font-medium">
                      Scanning...
                    </span>
                  </>
                ) : isDataAvailable && scanData ? (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-green-600 font-medium">
                      Ready
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-500 font-medium">
                      Idle
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* Informations supplémentaires pendant le scan */}
            {isScanning && displayStats.currentPath && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 transition-all duration-300">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="flex-1">
                    <div className="text-xs text-blue-600 font-medium mb-1">Currently scanning:</div>
                    <div className="text-sm text-blue-800 font-mono break-all transition-all duration-300">
                      {displayStats.currentPath}
                    </div>
                  </div>
                </div>
                {/* Barre de progression secondaire pour le chemin */}
                <div className="mt-2 w-full bg-blue-200 rounded-full h-1 overflow-hidden">
                  <div className="h-1 bg-blue-500 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
              </div>
            )}

            {/* Actions disponibles quand des données existent */}
            {!isScanning && isDataAvailable && (
              <div className="mt-6 flex justify-center space-x-3">
                <Button
                  onClick={() => setLocation('/scan-results')}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  <ChartPie className="w-4 h-4 mr-2" />
                  View Results
                </Button>
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
          <h3 className="font-semibold text-gray-900 mb-2">Scan Results</h3>
          <p className="text-sm text-gray-600">Scan files and folders to identify space usage patterns</p>
        </div>
        <div className="feature-card">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="icon-green" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Space Cleanup</h3>
          <p className="text-sm text-gray-600">Identify large files and folders for easy cleanup</p>
        </div>
        <div className="feature-card">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Fan className="icon-purple" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Erroring</h3>
          <p className="text-sm text-gray-600">Identify large files and folders for easy cleanup</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;