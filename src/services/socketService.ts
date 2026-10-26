import { io, Socket } from 'socket.io-client';
import apiClient from '../api/client';

type SocketEventCallback = (data: any) => void;

class RealtimeSocketService {
  private socket: Socket | null = null;
  private currentUserId: string | null = null;
  private listeners: Map<string, Set<SocketEventCallback>> = new Map();

  public getBackendUrl(): string {
    const base = apiClient.defaults.baseURL || 'https://api.globeverify.com/api';
    return base.replace(/\/api\/?$/, '');
  }

  public connect(userId?: string) {
    if (!userId) return;

    if (this.socket && this.socket.connected && this.currentUserId === userId) {
      return;
    }

    this.currentUserId = userId;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    const backendUrl = this.getBackendUrl();
    this.socket = io(backendUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      if (this.currentUserId && this.socket) {
        this.socket.emit('identify', this.currentUserId);
      }
    });

    const events = ['otp_received', 'rental_extended', 'new_notification'];
    events.forEach((evt) => {
      this.socket?.on(evt, (payload: any) => {
        const set = this.listeners.get(evt);
        if (set) {
          set.forEach((cb) => {
            try {
              cb(payload);
            } catch {}
          });
        }
      });
    });
  }

  public disconnect() {
    this.currentUserId = null;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public subscribe(
    event: 'otp_received' | 'rental_extended' | 'new_notification',
    callback: SocketEventCallback
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }
}

export const socketService = new RealtimeSocketService();
