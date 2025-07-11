import { invoke } from '@tauri-apps/api/core';
import { ErrorLog, ErrorData } from '../types/error';

export const errorApi = {
  // Récupérer tous les logs d'erreur
  async getErrorLogs(): Promise<ErrorLog[]> {
    try {
      return await invoke('get_error_logs');
    } catch (error) {
      console.error('Failed to get error logs:', error);
      return [];
    }
  },

  // Récupérer les données d'erreur complètes
  async getErrorData(): Promise<ErrorData | null> {
    try {
      return await invoke('get_error_data');
    } catch (error) {
      console.error('Failed to get error data:', error);
      return null;
    }
  },

  // Vérifier s'il y a une erreur de scan
  async hasScanError(): Promise<boolean> {
    try {
      return await invoke('has_scan_error');
    } catch (error) {
      console.error('Failed to check scan error:', error);
      return false;
    }
  },

  // Effacer les logs d'erreur
  async clearErrorLogs(): Promise<void> {
    try {
      await invoke('clear_error_logs');
    } catch (error) {
      console.error('Failed to clear error logs:', error);
      throw error;
    }
  }
};
