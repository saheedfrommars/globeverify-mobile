import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CallLogItem {
  id: string;
  callControlId?: string;
  phoneNumber: string; // My leased number
  remoteNumber: string; // The caller or callee
  direction: 'inbound' | 'outbound';
  status: 'completed' | 'missed' | 'rejected' | 'failed';
  duration: number; // in seconds
  timestamp: number; // Date.now()
  rentalId?: string;
}

const STORAGE_KEY = 'gv_call_logs_v1';
const MAX_LOGS = 200;

type LogListener = (logs: CallLogItem[]) => void;
const listeners = new Set<LogListener>();

export const callLogService = {
  /**
   * Retrieve all call logs from local storage, sorted newest first
   */
  async getLogs(): Promise<CallLogItem[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const logs: CallLogItem[] = JSON.parse(raw);
      return Array.isArray(logs) ? logs.sort((a, b) => b.timestamp - a.timestamp) : [];
    } catch (e) {
      console.warn('[callLogService] Failed to load call logs:', e);
      return [];
    }
  },

  /**
   * Save a new call log entry to local storage
   */
  async saveLog(log: Omit<CallLogItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): Promise<CallLogItem> {
    try {
      const current = await this.getLogs();
      const newEntry: CallLogItem = {
        id: log.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        callControlId: log.callControlId,
        phoneNumber: log.phoneNumber || 'Private Line',
        remoteNumber: log.remoteNumber || 'Unknown',
        direction: log.direction,
        status: log.status,
        duration: Math.max(0, log.duration || 0),
        timestamp: log.timestamp || Date.now(),
        rentalId: log.rentalId,
      };

      const updated = [newEntry, ...current.filter((l) => l.id !== newEntry.id)].slice(0, MAX_LOGS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Notify active subscribers
      listeners.forEach((listener) => {
        try {
          listener(updated);
        } catch (err) {}
      });

      return newEntry;
    } catch (e) {
      console.warn('[callLogService] Failed to save call log:', e);
      const fallback: CallLogItem = {
        id: String(Date.now()),
        phoneNumber: log.phoneNumber,
        remoteNumber: log.remoteNumber,
        direction: log.direction,
        status: log.status,
        duration: log.duration,
        timestamp: Date.now(),
      };
      return fallback;
    }
  },

  /**
   * Delete a single call log by ID
   */
  async deleteLog(id: string): Promise<void> {
    try {
      const current = await this.getLogs();
      const updated = current.filter((l) => l.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      listeners.forEach((listener) => {
        try {
          listener(updated);
        } catch (err) {}
      });
    } catch (e) {
      console.warn('[callLogService] Failed to delete call log:', e);
    }
  },

  /**
   * Clear all call logs from local storage
   */
  async clearAllLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);

      listeners.forEach((listener) => {
        try {
          listener([]);
        } catch (err) {}
      });
    } catch (e) {
      console.warn('[callLogService] Failed to clear call logs:', e);
    }
  },

  /**
   * Subscribe to call log changes
   */
  subscribe(listener: LogListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
