import { useState, useEffect } from 'react';
import { ErrorLog, ErrorData } from '../types/error';
import { errorApi } from '../lib/error-api';

export const useErrorData = () => {
  const [errorData, setErrorData] = useState<ErrorData | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchErrorData = async () => {
    try {
      setLoading(true);
      const [errorDataResult, errorLogsResult, hasErrorResult] = await Promise.all([
        errorApi.getErrorData(),
        errorApi.getErrorLogs(),
        errorApi.hasScanError()
      ]);

      setErrorData(errorDataResult);
      setErrorLogs(errorLogsResult);
      setHasError(hasErrorResult);
    } catch (error) {
      console.error('Failed to fetch error data:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await errorApi.clearErrorLogs();
      setErrorLogs([]);
      if (errorData) {
        setErrorData({ ...errorData, errorLogs: [] });
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw error;
    }
  };

  const refreshData = () => {
    fetchErrorData();
  };

  useEffect(() => {
    fetchErrorData();
  }, []);

  return {
    errorData,
    errorLogs,
    hasError,
    loading,
    clearLogs,
    refreshData
  };
};
