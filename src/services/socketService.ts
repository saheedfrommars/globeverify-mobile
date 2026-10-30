import { io, Socket } from 'socket.io-client';
import apiClient from '../api/client';

type SocketEventCallback = (data: any) => void;

export type SupportedSocketEvent =
  | 'otp_received'
  | 'rental_extended'
  | 'new_notification'
  | 'incoming_call'
  | 'call_answered'
  | 'call_ended'
  | 'call_transcription_update'
  | 'chat_message_received'
  | 'balance_updated'
  | 'telegram_linked'
  | 'telegram_unlinked';

class RealtimeSocketService {
  private socket: Socket | null = null;
  private currentUserId: string | null = null;
  private currentToken: string | null = null;
  private listeners: Map<string, Set<SocketEventCallback>> = new Map();

  public getBackendUrl(): string {
    const base = apiClient.defaults.baseURL || 'https://api.globeverify.com/api';
    return base.replace(/\/api\/?$/, '');
  }

  public isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public connect(userId?: string, token?: string | null) {
    if (!userId) return;

    if (this.socket && this.socket.connected && this.currentUserId === userId) {
      return;
    }

    this.currentUserId = userId;
    this.currentToken = token || null;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    const backendUrl = this.getBackendUrl();

    // In React Native / mobile, native WebSockets connect faster and bypass XHR polling CORS issues
    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 1,
      reconnectionDelay: 10000,
      timeout: 10000,
      auth: {
        token: this.currentToken,
      },
      extraHeaders: this.currentToken
        ? { Authorization: `Bearer ${this.currentToken}` }
        : undefined,
    });

    this.socket.on('connect', () => {
      if (this.currentUserId && this.socket) {
        this.socket.emit('identify', this.currentUserId);
      }
    });

    this.socket.on('connect_error', (err: any) => {
      console.warn(`[Socket] Connection error: ${err?.message || err}`);
    });

    this.socket.on('disconnect', (reason: string) => {
    });

    this.socket.io.on('reconnect', (attempt: number) => {
      if (this.currentUserId && this.socket) {
        this.socket.emit('identify', this.currentUserId);
      }
    });

    const events: SupportedSocketEvent[] = [
      'otp_received',
      'rental_extended',
      'new_notification',
      'incoming_call',
      'call_answered',
      'call_ended',
      'call_transcription_update',
      'chat_message_received',
      'balance_updated',
      'telegram_linked',
      'telegram_unlinked',
    ];

    events.forEach((evt) => {
      this.socket?.on(evt, (payload: any) => {
        const set = this.listeners.get(evt);
        if (set) {
          set.forEach((cb) => {
            try {
              cb(payload);
            } catch (err) {
              console.warn(`[Socket] Listener error on ${evt}:`, err);
            }
          });
        }
      });
    });
  }

  public disconnect() {
    this.currentUserId = null;
    this.currentToken = null;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public subscribe(
    event: SupportedSocketEvent,
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
