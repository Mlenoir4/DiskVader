import { AlertTriangle, Download, RotateCcw, Home, CheckCircle, Search, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "../components/ui/toast-provider";
import { useState, useEffect } from "react";
import { useErrorData } from "../hooks/use-error-data";
import { useScanContext } from "../contexts/scan-context";

const ErrorPage = () => {
  const [, setLocation] = useLocation();
  const { addToast } = useToast();
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'info' | 'warning'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasWaitedForData, setHasWaitedForData] = useState(false);
  const { errorData, errorLogs, hasError, loading, clearLogs, refreshData } = useErrorData();
  const { hasError: contextHasError } = useScanContext();

  // Rediriger vers la page d'accueil si pas d'erreur de scan (après avoir attendu)
  useEffect(() => {
    if (hasWaitedForData && !loading && !hasError && !contextHasError && !errorData && errorLogs.length === 0) {
      console.log('No error data found, redirecting to home');
      setLocation('/');
    }
  }, [hasWaitedForData, loading, hasError, contextHasError, errorData, errorLogs, setLocation]);

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

  const handleBackToHome = () => {
    setLocation('/');
  };

  const handleRefresh = () => {
    refreshData();
    addToast({
      type: 'info',
      title: 'Refreshed',
      message: 'Error data has been refreshed.'
    });
  };

  const handleClearLogs = async () => {
    try {
      await clearLogs();
      addToast({
        type: 'success',
        title: 'Logs Cleared',
        message: 'Error logs have been cleared successfully.'
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Clear Failed',
        message: 'Failed to clear error logs.'
      });
    }
  };

  const handleExportLogs = () => {
    try {
      const logsToExport = errorData?.errorLogs || errorLogs;
      const logContent = logsToExport.map(log => 
        `[${log.timestamp}] ${log.level}: ${log.message}${log.path ? ` (${log.path})` : ''}`
      ).join('\n');
      
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'disk-analyzer-error-logs.txt';
      a.click();
      URL.revokeObjectURL(url);
      
      addToast({
        type: 'success',
        title: 'Logs Exported',
        message: 'Error logs have been exported successfully.'
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export error logs.'
      });
    }
  };

  // Utiliser les vraies données d'erreur (pas de données de démonstration)
  const currentErrorData = errorData || {
    errorCode: 'ERR_NO_DATA',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    path: 'Unknown',
    filesScanned: 0,
    dataAnalyzed: 0,
    scanDuration: 0,
    errorLogs: []
  };

  const currentLogs = errorData?.errorLogs || errorLogs;

  // Filter logs based on type and search term
  const filteredLogs = currentLogs.filter(log => {
    const matchesFilter = logFilter === 'all' || 
      (logFilter === 'error' && log.level.includes('ERROR')) ||
      (logFilter === 'info' && log.level.includes('INFO')) ||
      (logFilter === 'warning' && log.level.includes('WARN'));
    
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.path && log.path.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading error data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Error Icon and Title */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-yellow-600 text-2xl" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Scan Error</h1>
      </div>

      {/* Error Logs */}
      <Card className="mb-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-900">Error Logs</h3>
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                {filteredLogs.length} of {currentLogs.length} entries
              </span>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="text-blue-600 hover:text-blue-800"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportLogs}
                className="text-blue-600 hover:text-blue-800"
              >
                <Download className="w-4 h-4 mr-1" />
                Export Logs
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearLogs}
                className="text-red-600 hover:text-red-800"
              >
                Clear Logs
              </Button>
            </div>
          </div>
          
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search in logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex space-x-2">
              {(['all', 'error', 'info', 'warning'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={logFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLogFilter(filter)}
                  className={`capitalize ${
                    logFilter === filter ? 'bg-gray-900 text-white' : 'text-gray-600'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter}
                  {filter !== 'all' && (
                    <span className="ml-1 text-xs">
                      ({currentLogs.filter(log => log.level.includes(filter.toUpperCase())).length})
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        <CardContent className="p-0">
          {currentLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No error logs available.</p>
              <p className="text-sm mt-1">Logs will appear here when a scan encounters errors.</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No logs match your current filter criteria.</p>
            </div>
          ) : (
            <div className="bg-gray-900 text-green-400 font-mono text-sm max-h-96 overflow-y-auto">
              {filteredLogs.map((log, index) => {
                const originalIndex = currentLogs.indexOf(log);
                const logLevel = log.level.includes('ERROR') ? 'error' : 
                               log.level.includes('INFO') ? 'info' : 
                               log.level.includes('WARN') ? 'warning' : 'default';
                
                const logColors = {
                  error: 'text-red-400',
                  info: 'text-blue-400',
                  warning: 'text-yellow-400',
                  default: 'text-green-400'
                };

                // Highlight search term in message
                const highlightedMessage = searchTerm 
                  ? log.message.replace(
                      new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                      '<span class="bg-yellow-500 text-black px-1 rounded">$1</span>'
                    )
                  : log.message;

                return (
                  <div 
                    key={log.id} 
                    className={`px-4 py-2 border-l-2 hover:bg-gray-800 transition-colors ${
                      logLevel === 'error' ? 'border-red-500 bg-red-900/10' :
                      logLevel === 'info' ? 'border-blue-500 bg-blue-900/10' :
                      logLevel === 'warning' ? 'border-yellow-500 bg-yellow-900/10' :
                      'border-green-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-gray-400 text-xs">{log.timestamp}</span>
                          <span className={`text-xs px-1 rounded ${logColors[logLevel]}`}>
                            {log.level}
                          </span>
                        </div>
                        <span 
                          className={logColors[logLevel]}
                          dangerouslySetInnerHTML={{ __html: highlightedMessage }}
                        />
                        {log.path && (
                          <div className="text-gray-500 text-xs mt-1">
                            Path: {log.path}
                          </div>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs ml-4 flex-shrink-0">
                        #{originalIndex + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{currentErrorData.filesScanned.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Files Scanned</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatSize(currentErrorData.dataAnalyzed)}</div>
          <div className="text-sm text-gray-600">Data Analyzed</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{currentErrorData.scanDuration}s</div>
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
