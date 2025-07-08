import React, { useState, useEffect } from 'react';
import { Folder, FileText, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from './button';
import { invoke } from '@tauri-apps/api/core';

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

  // Charger TOUS les dossiers quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
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

  // Fonction pour créer une arborescence complète des dossiers
  const buildFolderTree = (folders: FolderWithFiles[]) => {
    if (!folders || folders.length === 0) return [];
    
    // Créer une map pour les dossiers par chemin
    const folderMap = new Map();
    const rootFolders: FolderWithFiles[] = [];
    
    // Trier les dossiers par chemin
    const sortedFolders = [...folders].sort((a, b) => {
      const aPath = a.path || '';
      const bPath = b.path || '';
      return aPath.localeCompare(bPath);
    });
    
    // Construire l'arbre
    sortedFolders.forEach(folder => {
      const folderData = {
        ...folder,
        children: [],
        level: 0
      };
      
      folderMap.set(folder.path, folderData);
      
      // Trouver le parent
      const parentPath = folder.path?.split('/').slice(0, -1).join('/');
      const parent = folderMap.get(parentPath);
      
      if (parent) {
        folderData.level = parent.level + 1;
        parent.children.push(folderData);
      } else {
        rootFolders.push(folderData);
      }
    });
    
    // Fonction récursive pour aplatir l'arbre en conservant l'ordre hiérarchique
    const flattenTree = (nodes: any[], result: any[] = []) => {
      nodes.forEach(node => {
        result.push(node);
        if (node.children && node.children.length > 0) {
          flattenTree(node.children, result);
        }
      });
      return result;
    };
    
    return flattenTree(rootFolders);
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

  // Fonction pour déterminer le niveau d'indentation basé sur la propriété level
  const getIndentLevel = (level: number) => {
    return Math.min(level * 24, 120); // Maximum 5 niveaux d'indentation
  };

  const toggleFolder = async (folderId: number) => {
    const folderIndex = foldersWithFiles.findIndex(f => f.id === folderId);
    
    if (folderIndex === -1) return;
    
    const folder = foldersWithFiles[folderIndex];
    
    if (!folder.expanded) {
      // Mettre à jour l'état pour afficher le chargement
      setFoldersWithFiles(prev => 
        prev.map((f, index) => 
          index === folderIndex 
            ? { ...f, loading: true }
            : f
        )
      );
      
      try {
        const files = await invoke('get_folder_files', { 
          folderPath: folder.path || '' 
        }) as FileItem[];
        
        // Mettre à jour avec les fichiers chargés
        setFoldersWithFiles(prev => 
          prev.map((f, index) => 
            index === folderIndex 
              ? { ...f, expanded: true, loading: false, files }
              : f
          )
        );
      } catch (error) {
        console.error('Error loading folder files:', error);
        // Arrêter le chargement en cas d'erreur
        setFoldersWithFiles(prev => 
          prev.map((f, index) => 
            index === folderIndex 
              ? { ...f, loading: false }
              : f
          )
        );
      }
    } else {
      // Réduire le dossier
      setFoldersWithFiles(prev => 
        prev.map((f, index) => 
          index === folderIndex 
            ? { ...f, expanded: false, files: undefined }
            : f
        )
      );
    }
  };

  if (!isOpen) return null;

  // Construire l'arborescence complète des dossiers
  const folderTree = buildFolderTree(foldersWithFiles);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">All Folders - Directory Structure with Files</h2>
            <p className="text-sm text-gray-600">
              {loading ? 'Loading folders...' : `${folderTree.length.toLocaleString()} folders found`}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
            <p className="text-gray-600">Loading all folders...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folderTree && folderTree.length > 0 ? (
              folderTree.map((folder, index) => {
                const indentLevel = getIndentLevel(folder.level);
                
                return (
                  <div key={folder.id || index}>
                    {/* Folder Header */}
                    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3" style={{ marginLeft: `${indentLevel}px` }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-auto"
                            onClick={() => toggleFolder(folder.id)}
                            disabled={folder.loading}
                          >
                            {folder.loading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : folder.expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                          <Folder className="icon-yellow flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">{folder.name}</div>
                            <div className="text-xs text-gray-500 truncate" title={folder.path}>
                              {getDisplayPath(folder.path || '')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6 flex-shrink-0">
                          <div className="text-sm font-medium text-blue-600">{formatSize(folder.size)}</div>
                          <div className="text-sm text-gray-600">
                            {(folder.file_count || 0).toLocaleString()} files
                          </div>
                          <div className="text-sm text-green-600">
                            {folder.percentage?.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      {folder.percentage && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300" 
                              style={{ width: `${folder.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Files in Folder */}
                    {folder.expanded && folder.files && (
                      <div className="ml-8 mt-2 space-y-1">
                        {folder.files.length > 0 ? (
                          folder.files.map((file) => (
                            <div 
                              key={file.id} 
                              className="bg-gray-50 rounded p-3 border-l-4 border-blue-200"
                              style={{ marginLeft: `${indentLevel + 20}px` }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <FileText className="w-4 h-4 text-gray-600" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{file.name}</div>
                                    <div className="text-xs text-gray-500">{file.type}</div>
                                  </div>
                                </div>
                                <div className="text-sm text-gray-600">
                                  {formatSize(file.size)}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div 
                            className="text-sm text-gray-500 text-center py-2"
                            style={{ marginLeft: `${indentLevel + 20}px` }}
                          >
                            No files found in this folder
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No folder data available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedFoldersModal;
