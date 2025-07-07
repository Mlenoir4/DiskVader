import { AlertTriangle, XCircle, Download, RotateCcw, Folder, Home, CheckCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useLocation } from "wouter";
import { mockErrorData } from "../lib/mock-data";

const ErrorPage = () => {
  const [, setLocation] = useLocation();

  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(1) + ' GB';
    } else if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else {
      return bytes + ' bytes';
    }
  };

  const handleRetry = () => {
    setLocation('/');
  };

  const handleChooseFolder = () => {
    setLocation('/');
  };

  const handleBackToHome = () => {
    setLocation('/');
  };

  const handleExportLogs = () => {
    // Simulate log export
    const logContent = mockErrorData.errorLogs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'disk-analyzer-error-logs.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Error Icon and Title */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-yellow-600 text-2xl" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Scan Error</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          An error occurred during the disk space analysis. Review the error details below.
        </p>
      </div>

      {/* Error Details Card */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3 mb-4">
            <XCircle className="text-red-600 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Access Denied</h3>
              <p className="text-gray-600">Unable to access the specified directory. Insufficient permissions to read folder contents.</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Error Code:</span>
              <span className="font-mono text-gray-900">{mockErrorData.errorCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Timestamp:</span>
              <span className="font-mono text-gray-900">{mockErrorData.timestamp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Path:</span>
              <span className="font-mono text-gray-900">{mockErrorData.path}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Files Scanned:</span>
              <span className="font-mono text-gray-900">{mockErrorData.filesScanned.toLocaleString()} before error</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Logs */}
      <Card className="mb-8">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Error Logs</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportLogs}
            className="text-blue-600 hover:text-blue-800"
          >
            <Download className="w-4 h-4 mr-1" />
            Export Logs
          </Button>
        </div>
        <CardContent className="p-6">
          <div className="error-log">
            {mockErrorData.errorLogs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="stats-card text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="icon-blue" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{mockErrorData.filesScanned.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Files Scanned</div>
        </Card>
        <Card className="stats-card text-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="icon-green" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatSize(mockErrorData.dataAnalyzed)}</div>
          <div className="text-sm text-gray-600">Data Analyzed</div>
        </Card>
        <Card className="stats-card text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="icon-purple" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{mockErrorData.scanDuration}s</div>
          <div className="text-sm text-gray-600">Scan Duration</div>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>Recommendations</span>
          </h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-green-600 mt-1 flex-shrink-0" />
              <span className="text-gray-700">Run the application with administrator privileges to access system directories</span>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-green-600 mt-1 flex-shrink-0" />
              <span className="text-gray-700">Try scanning a specific user directory instead of the entire system</span>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-green-600 mt-1 flex-shrink-0" />
              <span className="text-gray-700">Check folder permissions and ownership settings</span>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-green-600 mt-1 flex-shrink-0" />
              <span className="text-gray-700">Consider excluding system directories from the scan</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <Button
          onClick={handleRetry}
          className="bg-black text-white hover:bg-gray-800"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Retry Scan
        </Button>
        <Button
          onClick={handleChooseFolder}
          variant="outline"
          className="bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          <Folder className="w-4 h-4 mr-2" />
          Choose Different Folder
        </Button>
        <Button
          onClick={handleBackToHome}
          variant="outline"
          className="bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          <Home className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default ErrorPage;
