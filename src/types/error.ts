// Types pour les logs d'erreur et données d'erreur
export interface ErrorLog {
  id: number;
  timestamp: string;
  level: string;
  message: string;
  path?: string;
  error_code?: string;
}

export interface ErrorData {
  errorCode: string;
  timestamp: string;
  path: string;
  filesScanned: number;
  dataAnalyzed: number;
  scanDuration: number;
  errorLogs: ErrorLog[];
}
