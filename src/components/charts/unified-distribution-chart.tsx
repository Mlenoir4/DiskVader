import { useState, useMemo, useCallback } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { HardDrive, FileText, FolderOpen, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import CustomDoughnutChart from "./doughnut-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";

// Performance and display configuration
const PERFORMANCE_CONFIG = {
  LIST_PAGE_SIZE: 20,
  LIST_MAX_ITEMS: 100,
  TREEMAP_MAX_ITEMS: 12,
  PIE_MAX_ITEMS: 15,
  AGGREGATION_THRESHOLD: 0.01, // 1% - items below this will be grouped as "Others"
  VIRTUALIZATION_THRESHOLD: 50 // Use virtualization when more than 50 items
};

interface DataItem {
  name: string;
  type?: string;
  size: number;
  count?: number;
  color: string;
  percentage?: number;
}

interface ProcessedData {
  items: DataItem[];
  aggregatedItems: DataItem[];
  othersGroup?: DataItem;
  totalItems: number;
  hasMore: boolean;
}

interface UnifiedDistributionChartProps {
  fileTypeData?: DataItem[];
  folderData?: DataItem[];
  doughnutData?: DataItem[];
  totalSize: number;
  title?: string;
  showDataSelector?: boolean;
  showViewSelector?: boolean;
  defaultDataType?: 'fileTypes' | 'folders';
  defaultViewType?: 'pie' | 'treemap' | 'list';
  onDataTypeChange?: (type: 'fileTypes' | 'folders') => void;
  onViewTypeChange?: (type: 'pie' | 'treemap' | 'list') => void;
  isLoading?: boolean;
}

const UnifiedDistributionChart = ({
  fileTypeData = [],
  folderData = [],
  doughnutData = [],
  totalSize,
  title = "Data Distribution",
  showDataSelector = true,
  showViewSelector = true,
  defaultDataType = 'fileTypes',
  defaultViewType = 'pie',
  onDataTypeChange,
  onViewTypeChange,
  isLoading = false
}: UnifiedDistributionChartProps) => {
  const [selectedDataType, setSelectedDataType] = useState<'fileTypes' | 'folders' | 'overview'>(defaultDataType);
  const [selectedViewType, setSelectedViewType] = useState<'pie' | 'treemap' | 'list'>(defaultViewType);
  const [listPage, setListPage] = useState(0);
  const [showAllItems, setShowAllItems] = useState(false);

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

  // Memoized data processing for performance
  const processedData = useMemo((): ProcessedData => {
    const rawData = selectedDataType === 'fileTypes' ? fileTypeData : 
                   selectedDataType === 'folders' ? folderData.map(folder => ({
                     ...folder,
                     name: folder.name,
                     type: 'Folder'
                   })) : fileTypeData;

    if (!rawData.length) {
      return {
        items: [],
        aggregatedItems: [],
        totalItems: 0,
        hasMore: false
      };
    }

    // Sort by size (descending)
    const sortedData = [...rawData].sort((a, b) => b.size - a.size);
    
    // Calculate percentages
    const dataWithPercentages = sortedData.map(item => ({
      ...item,
      percentage: (item.size / totalSize) * 100
    }));

    // Aggregate small items for better performance and UX
    const aggregatedItems: DataItem[] = [];
    let othersGroup: DataItem | undefined;
    let othersSize = 0;
    let othersCount = 0;

    dataWithPercentages.forEach((item, index) => {
      if (item.percentage < PERFORMANCE_CONFIG.AGGREGATION_THRESHOLD && 
          aggregatedItems.length >= PERFORMANCE_CONFIG.PIE_MAX_ITEMS - 1) {
        othersSize += item.size;
        othersCount += item.count || 1;
      } else {
        aggregatedItems.push(item);
      }
    });

    // Create "Others" group if needed
    if (othersSize > 0) {
      othersGroup = {
        name: "Others",
        type: "Others", 
        size: othersSize,
        count: othersCount,
        color: "#9CA3AF",
        percentage: (othersSize / totalSize) * 100
      };
      aggregatedItems.push(othersGroup);
    }

    return {
      items: dataWithPercentages,
      aggregatedItems,
      othersGroup,
      totalItems: rawData.length,
      hasMore: rawData.length > PERFORMANCE_CONFIG.LIST_MAX_ITEMS
    };
  }, [selectedDataType, fileTypeData, folderData, totalSize]);

  // Get current data based on view type and pagination
  const getCurrentData = useCallback((): DataItem[] => {
    const { items, aggregatedItems } = processedData;
    
    switch (selectedViewType) {
      case 'pie':
        return aggregatedItems.slice(0, PERFORMANCE_CONFIG.PIE_MAX_ITEMS);
      case 'treemap':
        return aggregatedItems.slice(0, PERFORMANCE_CONFIG.TREEMAP_MAX_ITEMS);
      case 'list':
        if (showAllItems) {
          return items;
        }
        const startIndex = listPage * PERFORMANCE_CONFIG.LIST_PAGE_SIZE;
        const endIndex = startIndex + PERFORMANCE_CONFIG.LIST_PAGE_SIZE;
        return items.slice(startIndex, endIndex);
      default:
        return aggregatedItems;
    }
  }, [processedData, selectedViewType, listPage, showAllItems]);

  const handleDataTypeChange = useCallback((type: 'fileTypes' | 'folders') => {
    setSelectedDataType(type);
    setListPage(0); // Reset pagination
    setShowAllItems(false); // Reset show all
    onDataTypeChange?.(type);
  }, [onDataTypeChange]);

  const handleViewTypeChange = useCallback((type: 'pie' | 'treemap' | 'list') => {
    setSelectedViewType(type);
    setListPage(0); // Reset pagination
    setShowAllItems(false); // Reset show all
    onViewTypeChange?.(type);
  }, [onViewTypeChange]);

  const handleShowMore = useCallback(() => {
    setShowAllItems(true);
  }, []);

  const handleShowLess = useCallback(() => {
    setShowAllItems(false);
    setListPage(0);
  }, []);

  const handleNextPage = useCallback(() => {
    const maxPage = Math.ceil(processedData.items.length / PERFORMANCE_CONFIG.LIST_PAGE_SIZE) - 1;
    setListPage(prev => Math.min(prev + 1, maxPage));
  }, [processedData.items.length]);

  const handlePrevPage = useCallback(() => {
    setListPage(prev => Math.max(prev - 1, 0));
  }, []);

  const currentData = getCurrentData();

  const renderTreemapView = useMemo(() => () => {
    const currentData = getCurrentData();
    
    if (!currentData.length) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No data available for treemap visualization</p>
          </div>
        </div>
      );
    }

    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500',
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-gray-500',
      'bg-orange-500', 'bg-teal-500', 'bg-cyan-500', 'bg-lime-500'
    ];

    const layoutItems = currentData.map((item, index) => {
      const percentage = item.percentage || (item.size / totalSize) * 100;
      
      let gridClass;
      if (percentage >= 35) gridClass = 'col-span-4 row-span-3';
      else if (percentage >= 20) gridClass = 'col-span-3 row-span-2';
      else if (percentage >= 12) gridClass = 'col-span-2 row-span-2';
      else if (percentage >= 8) gridClass = 'col-span-2 row-span-1';
      else if (percentage >= 4) gridClass = 'col-span-1 row-span-2';
      else gridClass = 'col-span-1 row-span-1';

      return {
        ...item,
        percentage,
        color: colors[index % colors.length],
        gridClass
      };
    });

    return (
      <div className="h-full">
        <div className="grid grid-cols-8 grid-rows-6 gap-1 h-5/6">
          {layoutItems.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className={`${item.color} text-white rounded-lg p-2 flex flex-col justify-between transition-all hover:scale-105 cursor-pointer ${item.gridClass}`}
              title={`${item.name || item.type}: ${formatSize(item.size)} (${item.percentage.toFixed(1)}%)`}
            >
              <div>
                <div className="text-xs font-medium opacity-90 truncate">
                  {item.name || item.type}
                </div>
                {item.count && (
                  <div className="text-xs opacity-75">
                    {item.count.toLocaleString()} {selectedDataType === 'folders' ? 'files' : 'items'}
                  </div>
                )}
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
          ))}
        </div>
        {processedData.totalItems > PERFORMANCE_CONFIG.TREEMAP_MAX_ITEMS && (
          <div className="mt-2 text-center">
            <Badge variant="secondary" className="text-xs">
              Showing {currentData.length} of {processedData.totalItems} items
            </Badge>
          </div>
        )}
      </div>
    );
  }, [getCurrentData, processedData.totalItems, selectedDataType, totalSize, formatSize]);

  const renderListView = () => {
    const currentData = getCurrentData();
    const { totalItems, hasMore } = processedData;
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
            <p className="text-gray-600">Processing data...</p>
          </div>
        </div>
      );
    }

    if (!currentData.length) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No data available</p>
          </div>
        </div>
      );
    }

    const canShowMore = !showAllItems && totalItems > PERFORMANCE_CONFIG.LIST_PAGE_SIZE;
    const totalPages = Math.ceil(totalItems / PERFORMANCE_CONFIG.LIST_PAGE_SIZE);
    const isLastPage = listPage >= totalPages - 1;

    return (
      <div className="space-y-4">
        {/* Performance indicator for large datasets */}
        {totalItems > PERFORMANCE_CONFIG.VIRTUALIZATION_THRESHOLD && (
          <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <span>Large dataset detected ({totalItems.toLocaleString()} items)</span>
            <Badge variant="outline">
              {showAllItems ? 'All items' : `Page ${listPage + 1} of ${totalPages}`}
            </Badge>
          </div>
        )}

        {/* Items list with optimized rendering */}
        <div className={`space-y-3 ${showAllItems ? 'max-h-96 overflow-y-auto' : 'max-h-80 overflow-y-auto'}`}>
          {currentData.map((item, index) => {
            const percentage = item.percentage || (item.size / totalSize) * 100;
            const globalIndex = showAllItems ? index : (listPage * PERFORMANCE_CONFIG.LIST_PAGE_SIZE) + index;
            
            return (
              <div key={`${item.name}-${globalIndex}`} className="transition-all hover:bg-gray-50 p-2 rounded">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">{item.name || item.type}</span>
                      {item.count && (
                        <span className="text-xs text-gray-500">
                          ({item.count.toLocaleString()} {selectedDataType === 'folders' ? 'files' : 'items'})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 flex-shrink-0">
                    <div className="text-sm text-gray-900">{formatSize(item.size)}</div>
                    <div className="text-sm text-gray-600 w-12 text-right">{percentage.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${Math.min(percentage, 100)}%`,
                      backgroundColor: item.color 
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination and Show More controls */}
        {canShowMore && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {showAllItems ? totalItems : Math.min((listPage + 1) * PERFORMANCE_CONFIG.LIST_PAGE_SIZE, totalItems)} of {totalItems.toLocaleString()} items
            </div>
            <div className="flex items-center space-x-2">
              {!showAllItems && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handlePrevPage}
                    disabled={listPage === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    {listPage + 1} / {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleNextPage}
                    disabled={isLastPage}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={showAllItems ? handleShowLess : handleShowMore}
                className="ml-2"
              >
                {showAllItems ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Show All
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Large dataset warning */}
        {totalItems > 1000 && showAllItems && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
            ⚠️ Large dataset: Rendering {totalItems.toLocaleString()} items may impact performance
          </div>
        )}
      </div>
    );
  };

  const renderPieView = useMemo(() => () => {
    const currentData = getCurrentData();
    
    if (!currentData.length) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No data available for pie chart</p>
          </div>
        </div>
      );
    }

    const pieData = currentData.map(item => ({
      name: item.name || item.type || 'Unknown',
      value: item.size / 1_000_000_000, // Convert to GB for chart display
      originalSize: item.size, // Keep original size in bytes for tooltip
      color: item.color
    }));

    // Function to format values in tooltip
    const formatTooltipValue = (gbValue: number, index?: number) => {
      const originalSize = pieData[index || 0]?.originalSize || gbValue * 1_000_000_000;
      return formatSize(originalSize);
    };

    return (
      <div className="h-full">
        <CustomDoughnutChart 
          data={pieData} 
          height={280}
          centerText={formatSize(totalSize)}
          centerSubText={selectedDataType === 'overview' ? 'Used Space' : 'Total Size'}
          formatValue={(value, data) => {
            return data && data.originalSize ? formatSize(data.originalSize) : formatSize(value * 1_000_000_000);
          }}
        />
        {processedData.totalItems > PERFORMANCE_CONFIG.PIE_MAX_ITEMS && (
          <div className="mt-2 text-center">
            <Badge variant="secondary" className="text-xs">
              Showing top {currentData.length} items of {processedData.totalItems}
              {processedData.othersGroup && ` (+ ${processedData.othersGroup.count} in "Others")`}
            </Badge>
          </div>
        )}
      </div>
    );
  }, [getCurrentData, processedData, selectedDataType, totalSize, formatSize]);

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'fileTypes':
        return <FileText className="w-4 h-4" />;
      case 'folders':
        return <FolderOpen className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getDataTypeLabel = (type: string) => {
    switch (type) {
      case 'fileTypes':
        return 'File Types';
      case 'folders':
        return 'Folders';
      default:
        return 'File Types';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center space-x-2">
            {getDataTypeIcon(selectedDataType)}
            <span>{title}</span>
          </CardTitle>
          <div className="flex items-center space-x-3">
            {/* Data Type Selector */}
            {showDataSelector && (
              <Select value={selectedDataType} onValueChange={handleDataTypeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fileTypes">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span>File Types</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="folders">
                    <div className="flex items-center space-x-2">
                      <FolderOpen className="w-4 h-4" />
                      <span>Folders</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* View Type Selector */}
            {showViewSelector && (
              <div className="flex space-x-2">
                <Button 
                  variant={selectedViewType === 'pie' ? 'default' : 'outline'} 
                  size="sm" 
                  className={`text-sm px-3 py-1 ${selectedViewType === 'pie' ? 'bg-black text-white' : ''}`}
                  onClick={() => handleViewTypeChange('pie')}
                >
                  Pie
                </Button>
                <Button 
                  variant={selectedViewType === 'treemap' ? 'default' : 'outline'} 
                  size="sm" 
                  className={`text-sm px-3 py-1 ${selectedViewType === 'treemap' ? 'bg-black text-white' : ''}`}
                  onClick={() => handleViewTypeChange('treemap')}
                >
                  Treemap
                </Button>
                <Button 
                  variant={selectedViewType === 'list' ? 'default' : 'outline'} 
                  size="sm" 
                  className={`text-sm px-3 py-1 ${selectedViewType === 'list' ? 'bg-black text-white' : ''}`}
                  onClick={() => handleViewTypeChange('list')}
                >
                  List
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
                <p className="text-gray-600">Loading data...</p>
              </div>
            </div>
          ) : (
            <>
              {selectedViewType === 'pie' && renderPieView()}
              {selectedViewType === 'treemap' && renderTreemapView()}
              {selectedViewType === 'list' && renderListView()}
            </>
          )}
        </div>
        <div className="mt-4 text-sm text-gray-600 text-center">
          {isLoading ? (
            'Processing data for visualization...'
          ) : (
            <>
              {selectedViewType === 'pie' && 'Interactive pie chart visualization'}
              {selectedViewType === 'treemap' && `Proportional treemap of ${getDataTypeLabel(selectedDataType).toLowerCase()}`}
              {selectedViewType === 'list' && `Detailed list view of ${getDataTypeLabel(selectedDataType).toLowerCase()}`}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UnifiedDistributionChart;
