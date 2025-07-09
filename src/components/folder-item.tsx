import { Folder, ExternalLink } from "lucide-react";

interface FolderItemProps {
  name: string;
  path?: string;
  size: number;
  fileCount: number;
  percentage?: number;
  showProgress?: boolean;
  showActions?: boolean;
  onView?: () => void;
}

const FolderItem = ({ 
  name, 
  path, 
  size, 
  fileCount, 
  percentage, 
  showProgress = false, 
  showActions = false,
  onView 
}: FolderItemProps) => {
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

  const getProgressColor = () => {
    if (!percentage) return 'bg-blue-600';
    if (percentage > 70) return 'bg-red-600';
    if (percentage > 40) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center space-x-3">
        <Folder className="text-yellow-600" />
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-600">
            {fileCount.toLocaleString()} files
            {path && ` • ${path}`}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {showProgress && percentage && (
          <div className="progress-bar w-32">
            <div 
              className={`progress-fill ${getProgressColor()}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
        <div className="text-sm font-medium text-gray-900 w-16 text-right">
          {formatSize(size)}
        </div>
        {percentage && (
          <div className="text-sm text-gray-600 w-12 text-right">
            {percentage.toFixed(1)}%
          </div>
        )}
        {showActions && onView && (
          <button
            onClick={onView}
            className="text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FolderItem;
