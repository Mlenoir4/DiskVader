import { useState, useEffect } from "react";
import { Trash2, Clock, Copy, FileText, Archive, Image, Database, ExternalLink, Loader2, Video } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../components/ui/toast-provider";
import { invoke } from "@tauri-apps/api/core";
import { useScanContext } from "../contexts/scan-context";

interface CleanupSuggestion {
  type: string;
  size: number;
  count: number;
  color_class: string;
  selected?: boolean;
}

const SpaceCleanup = () => {
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [cleanupItems, setCleanupItems] = useState<CleanupSuggestion[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<CleanupSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedCleanupFilter, setSelectedCleanupFilter] = useState<string | null>(null);
  const [trashInfo, setTrashInfo] = useState<{size: number, count: number} | null>(null);
  const { addToast } = useToast();
  const { 
    scanData, 
    largestFiles, 
    folders,
    fileTypeDistribution,
    isDataAvailable 
  } = useScanContext();
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Charger les données de nettoyage depuis le backend
        const cleanupData = await invoke("get_cleanup_suggestions");
        if (cleanupData) {
          const suggestionsWithSelection = (cleanupData as CleanupSuggestion[]).map(item => ({
            ...item,
            selected: false
          }));
          setCleanupItems(suggestionsWithSelection);
        }
      } catch (error) {
        console.error('Error loading cleanup data:', error);
        addToast({
          type: 'error',
          title: 'Error Loading Data',
          message: 'Failed to load cleanup suggestions.'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [addToast]);

  // Update dynamic suggestions when scan data changes
  useEffect(() => {
    if (isDataAvailable) {
      const dynamicSuggs = generateCleanupSuggestions();
      setDynamicSuggestions(dynamicSuggs);
    }
  }, [isDataAvailable, folders, largestFiles, fileTypeDistribution]);

  // Load trash information
  useEffect(() => {
    const loadTrashInfo = async () => {
      try {
        const trashData = await invoke("get_trash_info");
        setTrashInfo(trashData as {size: number, count: number});
      } catch (error) {
        console.error('Error loading trash info:', error);
      }
    };
    loadTrashInfo();
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

  const toggleCleanupItem = (index: number) => {
    // Check if it's a backend suggestion or dynamic suggestion
    if (index < cleanupItems.length) {
      // Backend suggestion
      setCleanupItems(prev => prev.map((item, i) => 
        i === index ? { ...item, selected: !item.selected } : item
      ));
    } else {
      // Dynamic suggestion
      const dynamicIndex = index - cleanupItems.length;
      setDynamicSuggestions(prev => prev.map((item, i) => 
        i === dynamicIndex ? { ...item, selected: !item.selected } : item
      ));
    }
  };

  const toggleAllCleanupItems = (checked: boolean) => {
    setCleanupItems(prev => prev.map(item => ({ ...item, selected: checked })));
    setDynamicSuggestions(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const handleCleanupItemClick = (item: CleanupSuggestion, index: number) => {
    // Toggle selection
    toggleCleanupItem(index);
    
    // Set filter for largest files table
    if (selectedCleanupFilter === item.type) {
      setSelectedCleanupFilter(null); // Deselect if already selected
    } else {
      setSelectedCleanupFilter(item.type);
    }
  };

  const handleCleanAllSelected = async () => {
    try {
      setCleaningUp(true);
      const selectedItems = cleanupItems.filter(item => item.selected);
      if (selectedItems.length === 0) {
        addToast({
          type: 'warning',
          title: 'No Items Selected',
          message: 'Please select items to clean.'
        });
        return;
      }

      await invoke("clean_selected_items", { items: selectedItems });
      
      // Refresh cleanup suggestions
      const newCleanupData = await invoke("get_cleanup_suggestions");
      setCleanupItems(newCleanupData as any[]);
      
      addToast({
        type: 'success',
        title: 'Cleanup Completed',
        message: `Successfully cleaned ${selectedItems.length} items.`
      });
    } catch (error) {
      console.error('Error cleaning items:', error);
      addToast({
        type: 'error',
        title: 'Cleanup Failed',
        message: 'Failed to clean selected items. Please try again.'
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const handleFileSelect = (fileId: number, checked: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(fileId);
    } else {
      newSelected.delete(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const formatFileModifiedDate = (file: any) => {
    // Format date for display - this is a placeholder since FileItem doesn't have modified date
    return "Recent";
  };

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'video':
        return <Video className="icon-blue" />;
      case 'archive':
      case 'zip':
        return <Archive className="icon-orange" />;
      case 'image':
      case 'jpg':
      case 'png':
      case 'gif':
        return <Image className="icon-green" />;
      case 'database':
      case 'sql':
        return <Database className="icon-purple" />;
      default:
        return <FileText className="icon-gray" />;
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await invoke("delete_file", { file_id: fileId });
      addToast({
        type: 'success',
        title: 'File Deleted',
        message: 'File has been deleted successfully.'
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete the file. Please try again.'
      });
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await invoke("empty_trash");
      
      // Update trash info after emptying
      setTrashInfo({size: 0, count: 0});
      
      addToast({
        type: 'success',
        title: 'Trash Emptied',
        message: 'Trash has been emptied successfully.'
      });
    } catch (error) {
      console.error('Error emptying trash:', error);
      addToast({
        type: 'error',
        title: 'Empty Trash Failed',
        message: 'Failed to empty trash. Please try again.'
      });
    }
  };

  const handleCompressFiles = async () => {
    try {
      const selectedFileIds = Array.from(selectedFiles);
      await invoke("compress_files", { file_ids: selectedFileIds });
      addToast({
        type: 'success',
        title: 'Files Compressed',
        message: 'Selected files have been compressed successfully.'
      });
    } catch (error) {
      console.error('Error compressing files:', error);
      addToast({
        type: 'error',
        title: 'Compression Failed',
        message: 'Failed to compress files. Please try again.'
      });
    }
  };

  const handleMoveToCloud = async () => {
    try {
      const selectedFileIds = Array.from(selectedFiles);
      await invoke("move_to_cloud", { file_ids: selectedFileIds });
      addToast({
        type: 'success',
        title: 'Files Moved to Cloud',
        message: 'Selected files have been moved to cloud storage.'
      });
    } catch (error) {
      console.error('Error moving to cloud:', error);
      addToast({
        type: 'error',
        title: 'Cloud Move Failed',
        message: 'Failed to move files to cloud. Please try again.'
      });
    }
  };

  // Generate dynamic cleanup suggestions based on real scan data
  const generateCleanupSuggestions = (): CleanupSuggestion[] => {
    const suggestions: CleanupSuggestion[] = [];
    
    if (!isDataAvailable) return [];

    // Large folders that could be compressed or cleaned
    const largeFolders = folders.filter(folder => folder.size > 1000000000); // > 1GB
    if (largeFolders.length > 0) {
      const totalLargeFoldersSize = largeFolders.reduce((sum, folder) => sum + folder.size, 0);
      suggestions.push({
        type: "Large Folders",
        size: totalLargeFoldersSize,
        count: largeFolders.length,
        color_class: "blue",
        selected: false
      });
    }

    // Duplicate files based on file type distribution
    const imageFiles = fileTypeDistribution.find(item => item.type.toLowerCase().includes('image'));
    if (imageFiles && imageFiles.count > 100) {
      // Estimate duplicates as 10-15% of image files
      const estimatedDuplicates = Math.floor(imageFiles.count * 0.12);
      const estimatedSize = Math.floor(imageFiles.size * 0.12);
      suggestions.push({
        type: "Duplicate Images",
        size: estimatedSize,
        count: estimatedDuplicates,
        color_class: "purple",
        selected: false
      });
    }

    // Very large files that could be archived
    const veryLargeFiles = largestFiles.filter(file => file.size > 5000000000); // > 5GB
    if (veryLargeFiles.length > 0) {
      const totalVeryLargeSize = veryLargeFiles.reduce((sum, file) => sum + file.size, 0);
      suggestions.push({
        type: "Archive Candidates",
        size: totalVeryLargeSize,
        count: veryLargeFiles.length,
        color_class: "orange",
        selected: false
      });
    }

    // Old large files (simulate based on largest files - could be moved to cloud)
    const oldLargeFiles = largestFiles.filter(file => file.size > 1000000000).slice(0, 10); // Top 10 large files
    if (oldLargeFiles.length > 0) {
      const totalOldSize = oldLargeFiles.reduce((sum, file) => sum + file.size, 0);
      suggestions.push({
        type: "Cloud Storage Candidates",
        size: totalOldSize,
        count: oldLargeFiles.length,
        color_class: "green",
        selected: false
      });
    }

    return suggestions;
  };

  const dynamicCleanupSuggestions = generateCleanupSuggestions();

  // Combine backend suggestions with dynamic suggestions, prioritizing backend data
  const allCleanupSuggestions = [
    ...cleanupItems,
    ...dynamicSuggestions.filter(dynSugg => 
      !cleanupItems.some(backendSugg => 
        backendSugg.type.toLowerCase().includes(dynSugg.type.toLowerCase().split(' ')[0])
      )
    )
  ];

  const filteredCleanupItems = filterType === 'all' 
    ? allCleanupSuggestions 
    : allCleanupSuggestions.filter(item => item.type.toLowerCase().includes(filterType.toLowerCase()));

  // Use real scan data if available, otherwise show loading or no data message
  const getFilteredLargestFiles = () => {
    if (!isDataAvailable) return [];
    
    let filteredFiles = largestFiles;
    
    // Apply cleanup suggestion filter
    if (selectedCleanupFilter) {
      if (selectedCleanupFilter.includes('Large Folders')) {
        // Show files from large folders
        const largeFolders = folders.filter(folder => folder.size > 1000000000);
        const largeFolderPaths = largeFolders.map(folder => folder.path || folder.name);
        filteredFiles = largestFiles.filter(file => 
          largeFolderPaths.some(folderPath => file.path.includes(folderPath))
        );
      } else if (selectedCleanupFilter.includes('Duplicate')) {
        // Show potential duplicate files (same extension, similar size)
        const imageFiles = largestFiles.filter(file => 
          ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file.extension.toLowerCase())
        );
        filteredFiles = imageFiles;
      } else if (selectedCleanupFilter.includes('Archive')) {
        // Show very large files (>5GB)
        filteredFiles = largestFiles.filter(file => file.size > 5000000000);
      } else if (selectedCleanupFilter.includes('Cloud')) {
        // Show large files suitable for cloud storage
        filteredFiles = largestFiles.filter(file => file.size > 1000000000);
      }
    }
    
    return filteredFiles.slice(0, 20);
  };

  const displayLargestFiles = getFilteredLargestFiles();
  const totalSpace = scanData?.total_size || 0;
  const usedSpace = totalSpace - (scanData?.free_space || 0);
  const freeSpace = scanData?.free_space || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading cleanup suggestions...</p>
        </div>
      </div>
    );
  }

  if (!isDataAvailable && !loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Space Cleanup</h1>
          <p className="text-gray-600 mb-8">No scan data available. Please run a disk scan first to enable cleanup features.</p>
          <Button 
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Go to Scanner
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Space Cleanup</h1>
          <p className="text-gray-600">Identify and remove large files to free up disk space</p>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Total Space:</span>
              <span className="font-semibold text-gray-900">{formatSize(totalSpace)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Used:</span>
              <span className="font-semibold text-red-600">{formatSize(usedSpace)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Available:</span>
              <span className="font-semibold text-green-600">{formatSize(freeSpace)}</span>
            </div>
          </div>
          {totalSpace > 0 && (
            <div className="flex flex-col items-end">
              <div className="text-sm text-gray-600 mb-1">
                {((usedSpace / totalSpace) * 100).toFixed(1)}% used
              </div>
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-red-500 transition-all duration-300"
                  style={{ width: `${(usedSpace / totalSpace) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Cleanup Suggestions */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Quick Cleanup Suggestions</h2>
            {allCleanupSuggestions.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Potential space savings: {formatSize(allCleanupSuggestions.reduce((sum, item) => sum + item.size, 0))}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleAllCleanupItems(true)}
              disabled={allCleanupSuggestions.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleAllCleanupItems(false)}
              disabled={allCleanupSuggestions.length === 0}
            >
              Deselect All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedCleanupFilter(null)}
              disabled={!selectedCleanupFilter}
            >
              Clear Filter
            </Button>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="duplicate">Duplicate Files</SelectItem>
                <SelectItem value="backup">Old Backups</SelectItem>
                <SelectItem value="large">Large Folders</SelectItem>
                <SelectItem value="archive">Archive Candidates</SelectItem>
                <SelectItem value="cloud">Cloud Storage</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleCleanAllSelected}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={cleaningUp || filteredCleanupItems.filter(item => item.selected).length === 0}
            >
              {cleaningUp ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {cleaningUp ? 'Cleaning...' : 'Clean All Selected'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filteredCleanupItems.length > 0 ? (
            filteredCleanupItems.map((item, index) => (
              <Card 
                key={index} 
                className={`stats-card cursor-pointer transition-all duration-200 ${
                  selectedCleanupFilter === item.type ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                }`}
                onClick={() => handleCleanupItemClick(item, index)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      checked={item.selected || false}
                      onCheckedChange={() => toggleCleanupItem(index)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {item.type.toLowerCase().includes('duplicate') && <Copy className="icon-purple" />}
                    {item.type.toLowerCase().includes('backup') && <Archive className="icon-blue" />}
                    {item.type.toLowerCase().includes('large') && <Database className="icon-blue" />}
                    {item.type.toLowerCase().includes('archive') && <Archive className="icon-orange" />}
                    {item.type.toLowerCase().includes('cloud') && <ExternalLink className="icon-green" />}
                    {item.type.toLowerCase().includes('empty') && <FileText className="icon-yellow" />}
                    {item.type.toLowerCase().includes('temp') && <Clock className="icon-orange" />}
                    {!item.type.toLowerCase().includes('duplicate') && 
                     !item.type.toLowerCase().includes('backup') && 
                     !item.type.toLowerCase().includes('large') &&
                     !item.type.toLowerCase().includes('archive') &&
                     !item.type.toLowerCase().includes('cloud') &&
                     !item.type.toLowerCase().includes('empty') && 
                     !item.type.toLowerCase().includes('temp') && <Trash2 className="icon-red" />}
                    <span className="font-medium text-gray-900">{item.type}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">{formatSize(item.size)}</div>
                <div className="text-sm text-gray-600">{item.count.toLocaleString()} items</div>
                {selectedCleanupFilter === item.type && (
                  <div className="text-xs text-blue-600 mt-2">
                    Click to view related files ↓
                  </div>
                )}
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <p className="text-gray-500">No cleanup suggestions available at the moment.</p>
            </div>
          )}
        </div>
      </div>

      {/* Largest Files Table */}
      <Card className="mb-8">
        <CardHeader className="border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Largest Files</CardTitle>
              {selectedCleanupFilter && (
                <p className="text-sm text-blue-600 mt-1">
                  Filtered by: {selectedCleanupFilter} • Click suggestion above to remove filter
                </p>
              )}
            </div>
            <div className="flex space-x-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All file types</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="size">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="size">Sort by size</SelectItem>
                  <SelectItem value="date">Sort by date</SelectItem>
                  <SelectItem value="name">Sort by name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayLargestFiles.map((file) => (
                <TableRow key={file.id} className="table-hover">
                  <TableCell>
                    <Checkbox 
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={(checked) => handleFileSelect(file.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      {getFileIcon(file.type)}
                      <div>
                        <div className="font-medium text-gray-900">{file.name}</div>
                        <div className="text-sm text-gray-600">{file.path}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatSize(file.size)}</TableCell>
                  <TableCell className="capitalize">{file.type}</TableCell>
                  <TableCell>{formatFileModifiedDate(file)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFile(file.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {displayLargestFiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {!isDataAvailable ? 'No scan data available. Please run a scan first.' : 
                     selectedCleanupFilter ? `No files found for ${selectedCleanupFilter}. Try a different filter.` : 
                     'No large files found.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="p-6 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {displayLargestFiles.length} of {isDataAvailable ? largestFiles.length : 0} large files
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button size="sm" className="bg-black text-white" disabled>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cleanup Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="feature-card">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Trash2 className="icon-red" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Empty Trash</h3>
          <div className="text-sm text-gray-600 mb-4">
            <p>Remove all items from trash permanently</p>
            {trashInfo ? (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Files in trash:</span>
                  <span className="font-medium">{trashInfo.count.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total size:</span>
                  <span className="font-medium text-red-600">{formatSize(trashInfo.size)}</span>
                </div>
                {trashInfo.size > 0 && (
                  <div className="text-xs text-green-600 mt-1">
                    💡 Free up {formatSize(trashInfo.size)} by emptying trash
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 mt-2">Loading trash info...</div>
            )}
          </div>
          <Button
            onClick={handleEmptyTrash}
            className="w-full bg-red-600 text-white hover:bg-red-700"
            disabled={!trashInfo || trashInfo.count === 0}
          >
            {trashInfo && trashInfo.count === 0 ? 'Trash is Empty' : 'Empty Trash'}
          </Button>
        </Card>
        <Card className="feature-card">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Archive className="icon-blue" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Compress Large Files</h3>
          <div className="text-sm text-gray-600 mb-4">
            <p>Compress files to save space</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Selected files:</span>
                <span className="font-medium">{selectedFiles.size}</span>
              </div>
              {selectedFiles.size > 0 && (
                <div className="flex justify-between">
                  <span>Est. savings:</span>
                  <span className="font-medium text-blue-600">
                    {formatSize(
                      displayLargestFiles
                        .filter(file => selectedFiles.has(file.id))
                        .reduce((sum, file) => sum + file.size * 0.3, 0) // Estimate 30% compression
                    )}
                  </span>
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                💡 Typical compression: 20-40% size reduction
              </div>
            </div>
          </div>
          <Button
            onClick={handleCompressFiles}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            disabled={selectedFiles.size === 0}
          >
            {selectedFiles.size === 0 ? 'Select Files First' : `Compress ${selectedFiles.size} Files`}
          </Button>
        </Card>
        <Card className="feature-card">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="icon-green" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Move to Cloud</h3>
          <div className="text-sm text-gray-600 mb-4">
            <p>Upload files to cloud storage</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Selected files:</span>
                <span className="font-medium">{selectedFiles.size}</span>
              </div>
              {selectedFiles.size > 0 && (
                <div className="flex justify-between">
                  <span>Total size:</span>
                  <span className="font-medium text-green-600">
                    {formatSize(
                      displayLargestFiles
                        .filter(file => selectedFiles.has(file.id))
                        .reduce((sum, file) => sum + file.size, 0)
                    )}
                  </span>
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                💡 Files will be moved to cloud and removed locally
              </div>
            </div>
          </div>
          <Button
            onClick={handleMoveToCloud}
            className="w-full bg-green-600 text-white hover:bg-green-700"
            disabled={selectedFiles.size === 0}
          >
            {selectedFiles.size === 0 ? 'Select Files First' : `Move ${selectedFiles.size} to Cloud`}
          </Button>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <div className="text-sm text-gray-600 mb-4">© 2025 All rights reserved</div>
      </div>
    </div>
  );
};

export default SpaceCleanup;
