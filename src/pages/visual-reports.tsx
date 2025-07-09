import { useState, useEffect } from "react";
import { Download, RefreshCw, FileText, Database, Folder, HardDrive, ArrowUp, ExternalLink, Loader2, SortAsc, SortDesc } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import CustomDoughnutChart from "../components/charts/doughnut-chart";
import TreeMapChart from "../components/charts/treemap-chart";
import CustomLineChart from "../components/charts/line-chart";
import LargeFilesModal from "../components/ui/large-files-modal";
import { useScanContext } from "../contexts/scan-context";
import { useLocation } from "wouter";
import { useToast } from "../components/ui/toast-provider";
import { invoke } from "@tauri-apps/api/core";

const VisualReports = () => {
  const [doughnutData, setDoughnutData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<'pie' | 'treemap'>('pie');
  const [timeFilter, setTimeFilter] = useState<'7D' | '30D' | '90D'>('30D');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isLargeFilesModalOpen, setIsLargeFilesModalOpen] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'size' | 'files' | 'percentage'>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [fileTypeModalOpen, setFileTypeModalOpen] = useState(false);
  const { addToast } = useToast();
  const [, setLocation] = useLocation();
  
  // Utiliser les données du contexte
  const { 
    scanData, 
    largestFiles, 
    folders, 
    fileTypeDistribution, 
    isDataAvailable,
    saveScanResults
  } = useScanContext();

  // Rediriger vers le dashboard si aucune donnée n'est disponible
  useEffect(() => {
    if (!isDataAvailable) {
      addToast({
        type: 'info',
        title: 'No Data Available',
        message: 'Please run a scan first to view visual reports.'
      });
      setLocation('/');
    }
  }, [isDataAvailable, addToast, setLocation]);

  useEffect(() => {
    const loadData = async () => {
      if (!isDataAvailable) return;
      
      try {
        setLoading(true);
        
        // Charger seulement les données supplémentaires nécessaires pour les graphiques
        const [
          doughnutResults,
          trendResults
        ] = await Promise.all([
          invoke("get_doughnut_data"),
          invoke("get_trend_data", { period: timeFilter })
        ]);

        setDoughnutData(doughnutResults as any[]);
        setTrendData(trendResults as any[]);
        
      } catch (error) {
        console.error('Error loading data:', error);
        addToast({
          type: 'error',
          title: 'Error Loading Data',
          message: 'Failed to load scan results from backend.'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [addToast]); // Retiré timeFilter pour éviter le double chargement

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
      setExporting(true);
      
      // Appel direct vers le backend Rust pour l'export uniquement
      await invoke("export_report");
      
      addToast({
        type: 'success',
        title: 'Report Exported',
        message: 'Your disk analysis report has been successfully exported.'
      });
    } catch (error) {
      console.error('Error exporting report:', error);
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export the report. Please try again.'
      });
    } finally {
      setExporting(false);
    }
  };

  const handleRefreshData = async () => {
    try {
      setRefreshing(true);
      
      // Recharger toutes les données via le backend Rust
      const [
        newScanData,
        newDoughnutData,
        newTrendData,
        newLargestFiles,
        newFolders,
        newFileTypes
      ] = await Promise.all([
        invoke("get_scan_results"),
        invoke("get_doughnut_data"),
        invoke("get_trend_data", { period: timeFilter }),
        invoke("get_largest_files"),
        invoke("get_folders"),
        invoke("get_file_type_distribution")
      ]);

      // Sauvegarder toutes les données dans le contexte
      saveScanResults(
        newScanData as any,
        newLargestFiles as any,
        newFolders as any,
        newFileTypes as any
      );
      
      setDoughnutData(newDoughnutData as any[]);
      setTrendData(newTrendData as any[]);
      
      addToast({
        type: 'success',
        title: 'Data Refreshed',
        message: 'Scan results have been updated successfully.'
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        message: 'Failed to refresh data. Please try again.'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleTimeFilterChange = async (filter: '7D' | '30D' | '90D') => {
    try {
      // Éviter le scroll vers le haut en prévenant l'événement
      if (timeFilter === filter) return; // Ne rien faire si c'est déjà sélectionné
      
      setTimeFilter(filter);
      
      // Appeler le backend pour obtenir les données de tendance pour la période spécifiée
      const newTrendData = await invoke("get_trend_data", { period: filter });
      setTrendData(newTrendData as any[]);
    } catch (error) {
      console.error('Error loading trend data:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load trend data for the selected period.'
      });
    }
  };

  const handleSort = (field: 'name' | 'size' | 'files' | 'percentage') => {
    const newDirection = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortDirection(newDirection);
    
    // Note: Le tri est fait côté UI pour l'affichage seulement
    // Les données restent inchangées dans le contexte
    console.log(`Sorting by ${field} in ${newDirection} order`);
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

  // Si aucune donnée n'est disponible, afficher un message
  if (!isDataAvailable) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h2>
          <p className="text-gray-600 mb-6">Please run a scan first to view visual reports.</p>
          <Button
            onClick={() => setLocation('/')}
            className="bg-black text-white hover:bg-gray-800"
          >
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Visual Reports</h1>
          <p className="text-gray-600">Interactive charts and visualizations of your disk space usage</p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={handleExportReport}
            variant="outline"
            className="bg-gray-100 text-gray-700 hover:bg-gray-200"
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {exporting ? 'Exporting...' : 'Export Report'}
          </Button>
          <Button
            onClick={handleRefreshData}
            className="bg-black text-white hover:bg-gray-800"
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
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
          <div className="text-2xl font-bold text-gray-900">{((scanData?.total_files || 0)).toLocaleString()}</div>
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
          <div className="text-2xl font-bold text-gray-900">{formatSize(scanData?.total_size || 0)}</div>
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
          <div className="text-sm text-gray-600">{folders.length > 0 ? formatSize(folders[0].size || 0) : 'N/A'}</div>
        </Card>
        <Card className="stats-card">
          <div className="flex items-center space-x-3 mb-2">
            <HardDrive className="icon-purple" />
            <span className="text-sm font-medium text-gray-600">Free Space</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatSize(scanData?.free_space || 0)}</div>
          <div className="text-sm text-gray-600">{(100 - (scanData?.used_percentage || 0)).toFixed(1)}% remaining</div>
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
                <Button 
                  variant={chartType === 'treemap' ? 'default' : 'outline'} 
                  size="sm" 
                  className={`text-sm px-3 py-1 ${chartType === 'treemap' ? 'bg-black text-white' : ''}`}
                  onClick={() => setChartType('treemap')}
                >
                  Treemap
                </Button>
                <Button 
                  variant={chartType === 'pie' ? 'default' : 'outline'} 
                  size="sm" 
                  className={`text-sm px-3 py-1 ${chartType === 'pie' ? 'bg-black text-white' : ''}`}
                  onClick={() => setChartType('pie')}
                >
                  Pie Chart
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {chartType === 'pie' ? (
                <CustomDoughnutChart 
                  data={doughnutData} 
                  height={320}
                  centerText={formatSize(scanData?.total_size || 0)}
                  centerSubText="Used Space"
                />
              ) : (
                // Treemap proportionnel basé sur les vraies données
                <div className="h-full">
                  {fileTypeDistribution && fileTypeDistribution.length > 0 ? (
                    <div className="h-full p-2">
                      {(() => {
                        const totalSize = scanData?.total_size || 1;
                        const sortedTypes = [...fileTypeDistribution]
                          .sort((a, b) => b.size - a.size)
                          .slice(0, 8); // Top 8 types de fichiers

                        // Algorithme de treemap plus précis basé sur les pourcentages réels
                        const createProportionalTreemap = (items: any[]) => {
                          const colors = [
                            'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500',
                            'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-gray-500'
                          ];

                          return items.map((item, index) => {
                            const percentage = (item.size / totalSize) * 100;
                            
                            // Calculer la hauteur et largeur basées sur le pourcentage réel
                            let width, height;
                            if (percentage >= 40) {
                              width = '50%'; height = '50%';
                            } else if (percentage >= 25) {
                              width = '50%'; height = '25%';
                            } else if (percentage >= 15) {
                              width = '25%'; height = '50%';
                            } else if (percentage >= 10) {
                              width = '25%'; height = '25%';
                            } else {
                              width = `${Math.max(percentage * 2, 8)}%`; 
                              height = `${Math.max(percentage * 2, 8)}%`;
                            }

                            return {
                              ...item,
                              percentage,
                              color: colors[index % colors.length],
                              width,
                              height,
                              // Ajustement pour éviter le chevauchement
                              style: {
                                width,
                                height,
                                minWidth: '60px',
                                minHeight: '40px'
                              }
                            };
                          });
                        };

                        const layoutItems = createProportionalTreemap(sortedTypes);

                        return (
                          <div className="grid grid-cols-8 grid-rows-6 gap-1 h-full">
                            {layoutItems.map((item, index) => {
                              // Calculer l'occupation de la grille en fonction du pourcentage
                              const getGridSpan = (percentage: number) => {
                                if (percentage >= 35) return 'col-span-4 row-span-3'; // Très gros: 50% de l'espace
                                if (percentage >= 20) return 'col-span-3 row-span-2'; // Gros: ~25% de l'espace
                                if (percentage >= 12) return 'col-span-2 row-span-2'; // Moyen: ~16% de l'espace
                                if (percentage >= 8) return 'col-span-2 row-span-1'; // Petit: ~8% de l'espace
                                if (percentage >= 4) return 'col-span-1 row-span-2'; // Très petit vertical
                                return 'col-span-1 row-span-1'; // Minuscule
                              };

                              const gridClass = getGridSpan(item.percentage);

                              return (
                                <div
                                  key={index}
                                  className={`${item.color} text-white rounded-lg p-2 flex flex-col justify-between transition-all hover:scale-105 cursor-pointer ${gridClass}`}
                                  title={`${item.type}: ${formatSize(item.size)} (${item.percentage.toFixed(1)}%)`}
                                >
                                  <div>
                                    <div className="text-xs font-medium opacity-90 truncate">
                                      {item.type}
                                    </div>
                                    <div className="text-xs opacity-75">
                                      {item.count?.toLocaleString()} files
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-bold">
                                      {formatSize(item.size)}
                                    </div>
                                    <div className="text-xs opacity-75">
                                      {item.percentage.toFixed(1)}%
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No data available for treemap visualization</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-600 text-center">
              {chartType === 'pie' ? 'Interactive pie chart visualization' : 'Proportional treemap based on file type sizes'}
            </div>
          </CardContent>
        </Card>

        {/* File Type Distribution */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>File Type Distribution</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-blue-600 hover:text-blue-800"
                onClick={() => setFileTypeModalOpen(true)}
              >
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
                      <span className="text-sm font-medium">{item.type}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-900">{formatSize(item.size)}</div>
                      <div className="text-sm text-gray-600">{(((item.size / (scanData?.total_size || 1)) * 100) || 0).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="progress-bar w-full mt-2">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${(((item.size / (scanData?.total_size || 1)) * 100) || 0).toFixed(1)}%`,
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
                <Button 
                  variant={timeFilter === '7D' ? 'default' : 'outline'} 
                  size="sm"
                  className={timeFilter === '7D' ? 'bg-black text-white' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTimeFilterChange('7D');
                  }}
                >
                  7D
                </Button>
                <Button 
                  variant={timeFilter === '30D' ? 'default' : 'outline'} 
                  size="sm"
                  className={timeFilter === '30D' ? 'bg-black text-white' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTimeFilterChange('30D');
                  }}
                >
                  30D
                </Button>
                <Button 
                  variant={timeFilter === '90D' ? 'default' : 'outline'} 
                  size="sm"
                  className={timeFilter === '90D' ? 'bg-black text-white' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTimeFilterChange('90D');
                  }}
                >
                  90D
                </Button>
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
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-blue-600 hover:text-blue-800"
                onClick={() => setIsLargeFilesModalOpen(true)}
              >
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
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-600 hover:text-blue-800"
              onClick={() => handleSort('size')}
            >
              {sortField === 'size' && sortDirection === 'desc' ? (
                <SortDesc className="w-4 h-4 mr-1" />
              ) : (
                <SortAsc className="w-4 h-4 mr-1" />
              )}
              Sort by Size
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Folder Name
                    {sortField === 'name' && (
                      sortDirection === 'desc' ? 
                      <SortDesc className="w-4 h-4 ml-1" /> : 
                      <SortAsc className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('size')}
                >
                  <div className="flex items-center">
                    Size
                    {sortField === 'size' && (
                      sortDirection === 'desc' ? 
                      <SortDesc className="w-4 h-4 ml-1" /> : 
                      <SortAsc className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('files')}
                >
                  <div className="flex items-center">
                    Files
                    {sortField === 'files' && (
                      sortDirection === 'desc' ? 
                      <SortDesc className="w-4 h-4 ml-1" /> : 
                      <SortAsc className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('percentage')}
                >
                  <div className="flex items-center">
                    % of Total
                    {sortField === 'percentage' && (
                      sortDirection === 'desc' ? 
                      <SortDesc className="w-4 h-4 ml-1" /> : 
                      <SortAsc className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </TableHead>
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
                  <TableCell>{formatSize(folder.size || 0)}</TableCell>
                  <TableCell>{(folder.file_count || 0).toLocaleString()}</TableCell>
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

      {/* Modal pour les gros fichiers */}
      <LargeFilesModal
        isOpen={isLargeFilesModalOpen}
        onClose={() => setIsLargeFilesModalOpen(false)}
        files={largestFiles}
      />

      {/* Modal pour la distribution des types de fichiers */}
      <FileTypeDistributionModal
        isOpen={fileTypeModalOpen}
        onClose={() => setFileTypeModalOpen(false)}
        fileTypes={fileTypeDistribution}
        totalSize={scanData?.total_size || 0}
      />
    </div>
  );
};

// Composant modal pour la distribution des types de fichiers
const FileTypeDistributionModal = ({ 
  isOpen, 
  onClose, 
  fileTypes, 
  totalSize 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  fileTypes: any[]; 
  totalSize: number; 
}) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Complete File Type Distribution</h2>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
        
        <div className="space-y-4">
          {fileTypes.map((item, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }}></div>
                  <span className="font-medium">{item.type}</span>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-sm font-medium">{formatSize(item.size)}</div>                      <div className="text-sm text-gray-600">
                    {(((item.size / totalSize) * 100) || 0).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${(((item.size / totalSize) * 100) || 0).toFixed(1)}%`,
                    backgroundColor: item.color 
                  }}
                />
              </div>
              {item.count && (
                <div className="text-xs text-gray-500 mt-2">
                  {item.count.toLocaleString()} files
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VisualReports;
