import { useState, useEffect } from "react";
import { Trash2, Download, Clock, Copy, FileText, Archive, Image, Database, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../components/ui/toast-provider";
import { invoke } from "@tauri-apps/api/core";
import { mockCleanupSuggestions } from "../lib/mock-data";

const SpaceCleanup = () => {
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [cleanupItems, setCleanupItems] = useState(mockCleanupSuggestions);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const { addToast } = useToast();
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Charger les données de nettoyage depuis le backend
        const cleanupData = await invoke("get_cleanup_suggestions");
        if (cleanupData) {
          setCleanupItems(cleanupData as any[]);
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
    setCleanupItems(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
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

  const largestFiles = [
    { id: 1, name: "movie_backup_2024.mkv", path: "/Users/john/Movies/", size: 4200000000, type: "video", modified: "Jan 15, 2025" },
    { id: 2, name: "project_archive.zip", path: "/Users/john/Downloads/", size: 3800000000, type: "archive", modified: "Dec 28, 2024" },
    { id: 3, name: "vacation_photos_raw.dmg", path: "/Users/john/Desktop/", size: 2900000000, type: "image", modified: "Nov 12, 2024" },
    { id: 4, name: "database_backup.sql", path: "/Users/john/Documents/", size: 1700000000, type: "database", modified: "Oct 3, 2024" },
    { id: 5, name: "design_assets_collection.pdf", path: "/Users/john/Work/", size: 1200000000, type: "document", modified: "Sep 18, 2024" }
  ];

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <FileText className="icon-blue" />;
      case 'archive':
        return <Archive className="icon-orange" />;
      case 'image':
        return <Image className="icon-green" />;
      case 'database':
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

  const filteredCleanupItems = filterType === 'all' 
    ? cleanupItems 
    : cleanupItems.filter(item => item.type === filterType);

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Space Cleanup</h1>
          <p className="text-gray-600">Identify and remove large files to free up disk space</p>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Total Space:</span>
            <span className="font-semibold text-gray-900">847.2 GB</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Available:</span>
            <span className="font-semibold text-green-600">156.8 GB</span>
          </div>
        </div>
      </div>

      {/* Quick Cleanup Suggestions */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Quick Cleanup Suggestions</h2>
          <div className="flex items-center space-x-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Trash">Trash</SelectItem>
                <SelectItem value="Downloads">Downloads</SelectItem>
                <SelectItem value="Temp Files">Temp Files</SelectItem>
                <SelectItem value="Duplicates">Duplicates</SelectItem>
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
          {filteredCleanupItems.map((item, index) => (
            <Card key={index} className="stats-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    checked={item.selected}
                    onCheckedChange={() => toggleCleanupItem(index)}
                  />
                  {item.type === 'Trash' && <Trash2 className="icon-red" />}
                  {item.type === 'Downloads' && <Download className="icon-blue" />}
                  {item.type === 'Temp Files' && <Clock className="icon-yellow" />}
                  {item.type === 'Duplicates' && <Copy className="icon-purple" />}
                  <span className="font-medium text-gray-900">{item.type}</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{formatSize(item.size)}</div>
              <div className="text-sm text-gray-600">{item.count.toLocaleString()} items</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Largest Files Table */}
      <Card className="mb-8">
        <CardHeader className="border-b border-gray-200">
          <div className="flex justify-between items-center">
            <CardTitle>Largest Files</CardTitle>
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
              {largestFiles.map((file) => (
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
                  <TableCell>{file.modified}</TableCell>
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
            </TableBody>
          </Table>
          <div className="p-6 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600">Showing 5 of 247 large files</div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">Previous</Button>
              <Button size="sm" className="bg-black text-white">Next</Button>
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
          <p className="text-sm text-gray-600 mb-4">Remove all items from trash permanently</p>
          <Button
            onClick={handleEmptyTrash}
            className="w-full bg-red-600 text-white hover:bg-red-700"
          >
            Empty Trash
          </Button>
        </Card>
        <Card className="feature-card">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Archive className="icon-blue" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Compress Large Files</h3>
          <p className="text-sm text-gray-600 mb-4">Compress files to save space</p>
          <Button
            onClick={handleCompressFiles}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            Compress Files
          </Button>
        </Card>
        <Card className="feature-card">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="icon-green" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Move to Cloud</h3>
          <p className="text-sm text-gray-600 mb-4">Upload files to cloud storage</p>
          <Button
            onClick={handleMoveToCloud}
            className="w-full bg-green-600 text-white hover:bg-green-700"
          >
            Move to Cloud
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
