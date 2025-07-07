import { FileVideo, FileArchive, FileImage, Database, FileText, File as FileIcon } from "lucide-react";

interface FileItemProps {
  name: string;
  path: string;
  size: number;
  type: string;
  extension?: string;
  showActions?: boolean;
  onDelete?: () => void;
}

const FileItem = ({ name, path, size, type, extension, showActions = false, onDelete }: FileItemProps) => {
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

  const getFileIcon = () => {
    switch (type) {
      case 'video':
        return <FileVideo className="icon-blue" />;
      case 'archive':
        return <FileArchive className="icon-orange" />;
      case 'image':
        return <FileImage className="icon-green" />;
      case 'database':
        return <Database className="icon-purple" />;
      case 'document':
        return <FileText className="icon-yellow" />;
      default:
        return <FileIcon className="icon-gray" />;
    }
  };

  return (
    <div className="file-item">
      <div className="flex items-center space-x-3">
        {getFileIcon()}
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-600">{path}</div>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-sm font-medium text-gray-900">{formatSize(size)}</div>
        {showActions && onDelete && (
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-800 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default FileItem;
