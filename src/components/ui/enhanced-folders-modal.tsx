import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Folder, FileText, ChevronDown, ChevronRight, Loader2, Search, Filter, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Badge } from './badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { invoke } from '@tauri-apps/api/core';

// Configuration pour les performances
const PERFORMANCE_CONFIG = {
  VIRTUAL_THRESHOLD: 100, // Activer la virtualisation si plus de 100 dossiers
  PAGE_SIZE: 50, // Nombre d'éléments par page
  INITIAL_VISIBLE: 20, // Nombre initial d'éléments visibles
  FILES_PREVIEW_LIMIT: 10, // Nombre de fichiers affichés par défaut par dossier
  SEARCH_DEBOUNCE: 300 // Délai en ms pour la recherche
};

interface FolderWithFiles {
  id: number;
  name: string;
  path?: string;
  size: number;
  file_count: number;
  percentage: number;
  files?: FileItem[];
  expanded?: boolean;
  loading?: boolean;
  level?: number;
  children?: FolderWithFiles[];
}

interface FileItem {
  id: number;
  name: string;
  path: string;
  size: number;
  type: string;
  extension: string;
}

interface EnhancedFoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderWithFiles[];
}

const EnhancedFoldersModal: React.FC<EnhancedFoldersModalProps> = ({ 
  isOpen, 
  onClose, 
  folders 
}) => {
  const [foldersWithFiles, setFoldersWithFiles] = useState<FolderWithFiles[]>([]);
  const [allFolders, setAllFolders] = useState<FolderWithFiles[]>([]);
  const [loading, setLoading] = useState(false);
  
  // États pour les nouvelles fonctionnalités
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'size' | 'name' | 'fileCount'>('size');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [filesPreviews, setFilesPreviews] = useState<Map<number, boolean>>(new Map());

  // Debounced search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(0); // Reset page when searching
    }, PERFORMANCE_CONFIG.SEARCH_DEBOUNCE);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Memoized filtered and sorted folders
  const processedFolders = useMemo(() => {
    let result = [...foldersWithFiles];
    
    // Filtrage par recherche
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter(folder => 
        folder.name.toLowerCase().includes(searchLower) ||
        (folder.path && folder.path.toLowerCase().includes(searchLower))
      );
    }
    
    // Tri
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'fileCount':
          comparison = a.file_count - b.file_count;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [foldersWithFiles, debouncedSearchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(processedFolders.length / PERFORMANCE_CONFIG.PAGE_SIZE);
  const startIndex = currentPage * PERFORMANCE_CONFIG.PAGE_SIZE;
  const endIndex = startIndex + PERFORMANCE_CONFIG.PAGE_SIZE;
  const currentFolders = showAll ? processedFolders : processedFolders.slice(startIndex, endIndex);
  
  // Contrôles de pagination
  const canGoPrevious = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setCurrentPage(0);
      setExpandedFolders(new Set());
      setFilesPreviews(new Map());
      loadAllFolders();
    }
  }, [isOpen]);

  const loadAllFolders = async () => {
    try {
      setLoading(true);
      
      // Essayer de récupérer tous les dossiers
      let allFoldersData: FolderWithFiles[] = [];
      
      try {
        // Essayer get_all_folders s'il existe
        allFoldersData = await invoke('get_all_folders') as FolderWithFiles[];
        console.log(`Enhanced Folders Modal: Loaded ${allFoldersData.length} folders from get_all_folders`);
      } catch (error) {
        console.error('get_all_folders failed, using provided folders:', error);
        // Utiliser les dossiers fournis en props comme fallback
        allFoldersData = folders || [];
        console.log(`Enhanced Folders Modal: Using ${allFoldersData.length} folders from props`);
      }
      
      // Initialiser l'état des dossiers
      const initializedFolders = allFoldersData.map(folder => ({ 
        ...folder, 
        expanded: false, 
        loading: false 
      }));
      
      setAllFolders(allFoldersData);
      setFoldersWithFiles(initializedFolders);
      
    } catch (error) {
      console.error('Error loading all folders:', error);
      // Fallback vers les dossiers fournis en props
      const initializedFolders = (folders || []).map(folder => ({ 
        ...folder, 
        expanded: false, 
        loading: false 
      }));
      setAllFolders(folders || []);
      setFoldersWithFiles(initializedFolders);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1099511627776) { // 1TB
      return (bytes / 1099511627776).toFixed(2) + ' TB';
    } else if (bytes >= 1073741824) { // 1GB
      return (bytes / 1073741824).toFixed(2) + ' GB';
    } else if (bytes >= 1048576) { // 1MB
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else if (bytes >= 1024) { // 1KB
      return (bytes / 1024).toFixed(0) + ' KB';
    } else {
      return bytes + ' bytes';
    }
  };

  // Optimized toggle folder function
  const toggleFolder = useCallback(async (folderId: number) => {
    const isExpanded = expandedFolders.has(folderId);
    
    if (isExpanded) {
      // Collapse folder
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
      
      // Remove files from state to save memory
      setFoldersWithFiles(prev => 
        prev.map(f => f.id === folderId ? { ...f, files: undefined, loading: false } : f)
      );
    } else {
      // Expand folder
      setExpandedFolders(prev => new Set([...prev, folderId]));
      
      const folder = foldersWithFiles.find(f => f.id === folderId);
      if (!folder) return;
      
      // Only load files if not already loaded
      if (!folder.files) {
        setFoldersWithFiles(prev => 
          prev.map(f => f.id === folderId ? { ...f, loading: true } : f)
        );
        
        try {
          const files = await invoke('get_folder_files', { 
            folderPath: folder.path || '' 
          }) as FileItem[];
          
          setFoldersWithFiles(prev => 
            prev.map(f => f.id === folderId ? { ...f, loading: false, files } : f)
          );
        } catch (error) {
          console.error('Error loading folder files:', error);
          setFoldersWithFiles(prev => 
            prev.map(f => f.id === folderId ? { ...f, loading: false } : f)
          );
        }
      }
    }
  }, [expandedFolders, foldersWithFiles]);

  // Toggle files preview limit
  const toggleFilesPreview = useCallback((folderId: number) => {
    setFilesPreviews(prev => {
      const newMap = new Map(prev);
      newMap.set(folderId, !newMap.get(folderId));
      return newMap;
    });
  }, []);

  // Pagination controls
  const handlePreviousPage = () => {
    if (canGoPrevious) setCurrentPage(prev => prev - 1);
  };

  const handleNextPage = () => {
    if (canGoNext) setCurrentPage(prev => prev + 1);
  };

  const handleShowAll = () => {
    setShowAll(!showAll);
    setCurrentPage(0);
  };

  // Fonction pour obtenir le chemin relatif d'affichage
  const getDisplayPath = (folderPath: string) => {
    if (!folderPath) return '/';
    const pathParts = folderPath.split('/').filter(part => part !== '');
    if (pathParts.length <= 3) {
      return '/' + pathParts.join('/');
    }
    return '/.../' + pathParts.slice(-2).join('/');
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-7xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header with controls */}
        <div className="flex-shrink-0 border-b border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold">All Folders - Directory Structure with Files</h2>
              <p className="text-sm text-gray-600">
                {loading 
                  ? 'Loading folders...' 
                  : `${processedFolders.length.toLocaleString()} folders found ${debouncedSearchTerm ? `(filtered from ${foldersWithFiles.length.toLocaleString()})` : ''}`
                }
              </p>
                  <div>CREATED BY ESTELLE CASU</div>

            </div>
            <Button variant="ghost" onClick={onClose}>✕</Button>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search folders by name or path..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Sort controls */}
            <Select value={sortBy} onValueChange={(value: 'size' | 'name' | 'fileCount') => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="size">Sort by Size</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="fileCount">Sort by File Count</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          
          {/* Pagination and view controls */}
          {!loading && processedFolders.length > PERFORMANCE_CONFIG.PAGE_SIZE && (
            <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>
                  Showing {showAll 
                    ? `all ${processedFolders.length.toLocaleString()}`
                    : `${startIndex + 1}-${Math.min(endIndex, processedFolders.length)} of ${processedFolders.length.toLocaleString()}`
                  } folders
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {!showAll && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={!canGoPrevious}
                    >
                      Previous
                    </Button>
                    <span className="px-2">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!canGoNext}
                    >
                      Next
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShowAll}
                  className="ml-2"
                >
                  {showAll ? 'Show Pages' : 'Show All'}
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
              <p className="text-gray-600">Loading all folders...</p>
            </div>
          ) : currentFolders.length > 0 ? (
            <div className="space-y-3">
              {currentFolders.map((folder) => {
                const isExpanded = expandedFolders.has(folder.id);
                const showAllFiles = filesPreviews.get(folder.id) || false;
                const filesToShow = folder.files ? 
                  (showAllFiles ? folder.files : folder.files.slice(0, PERFORMANCE_CONFIG.FILES_PREVIEW_LIMIT))
                  : [];
                
                return (
                  <div key={folder.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                    {/* Folder Header */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-auto flex-shrink-0"
                            onClick={() => toggleFolder(folder.id)}
                            disabled={folder.loading}
                          >
                            {folder.loading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                          <Folder className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate" title={folder.name}>
                              {folder.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate" title={folder.path}>
                              {getDisplayPath(folder.path || '')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6 flex-shrink-0">
                          <div className="text-sm font-medium text-blue-600">
                            {formatSize(folder.size)}
                          </div>
                          <div className="text-sm text-gray-600 text-center">
                            <div>{(folder.file_count || 0).toLocaleString()}</div>
                            <div className="text-xs">files</div>
                          </div>
                          <div className="text-sm text-green-600 text-center">
                            <div>{folder.percentage?.toFixed(1)}%</div>
                            <div className="text-xs">of total</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      {folder.percentage && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300" 
                            style={{ width: `${Math.min(folder.percentage, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Files in Folder */}
                    {isExpanded && folder.files && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-medium text-gray-900">
                            Files in folder ({folder.files.length.toLocaleString()})
                          </h4>
                          {folder.files.length > PERFORMANCE_CONFIG.FILES_PREVIEW_LIMIT && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFilesPreview(folder.id)}
                              className="text-xs"
                            >
                              {showAllFiles ? (
                                <>
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  Show Less
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3 mr-1" />
                                  Show All ({folder.files.length})
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {filesToShow.length > 0 ? (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                            {filesToShow.map((file) => (
                              <div 
                                key={file.id} 
                                className="bg-white rounded p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                                        {file.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {file.type} • {file.extension.toUpperCase()}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-600 flex-shrink-0">
                                    {formatSize(file.size)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            No files found in this folder
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {debouncedSearchTerm 
                ? 'No folders match your search criteria' 
                : 'No folder data available'
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedFoldersModal;
