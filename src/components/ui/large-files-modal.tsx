import React from 'react';
import { X, FileText, FolderOpen } from 'lucide-react';
import { Button } from './button';

interface LargeFile {
  id: number;
  name: string;
  path: string;
  size: number;
  file_type: string;
  extension: string;
}

interface LargeFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: LargeFile[];
}

const LargeFilesModal: React.FC<LargeFilesModalProps> = ({ isOpen, onClose, files }) => {
  const formatSize = (bytes: number) => {
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

  const getFileIcon = (extension: string) => {
    const iconClass = "w-5 h-5";
    switch (extension.toLowerCase()) {
      case 'mp4':
      case 'mov':
      case 'avi':
        return <FileText className={`${iconClass} text-blue-500`} />;
      case 'jpg':
      case 'png':
      case 'psd':
        return <FileText className={`${iconClass} text-green-500`} />;
      case 'zip':
      case 'rar':
        return <FileText className={`${iconClass} text-purple-500`} />;
      default:
        return <FileText className={`${iconClass} text-gray-500`} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">All Large Files</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="p-1"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-4">
                  {getFileIcon(file.extension)}
                  <div>
                    <div className="font-medium text-gray-900">{file.name}</div>
                    <div className="text-sm text-gray-500 flex items-center space-x-2">
                      <FolderOpen className="w-4 h-4" />
                      <span>{file.path}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatSize(file.size)}</div>
                  <div className="text-sm text-gray-500 capitalize">{file.file_type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LargeFilesModal;
