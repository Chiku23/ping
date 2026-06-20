import { Injectable, signal, computed, inject, NgZone, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, tap, map, concatMap } from 'rxjs/operators';
import { of, throwError, Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { CryptoService } from './crypto.service';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

export interface Message {
  id: number;
  sender: string;
  avatarInitials: string;
  avatarBg: string;
  message: string;
  time: string;
  isSelf: boolean;
}

export interface Chat {
  id: number;
  name: string;
  avatarInitials: string;
  avatarBg: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  messages: Message[];
  mobile?: string; // Contact's mobile number to initiate connection
}

export interface UserProfile {
  name: string;
  email: string;
  mobile: string;
  publicKey?: string;
  encryptedPrivateKey?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);
  readonly crypto = inject(CryptoService);

  // Dynamic API configuration
  readonly apiUrl = signal<string>(localStorage.getItem('ping_api_url') || environment.apiUrl);

  get API_URL(): string {
    return this.apiUrl();
  }

  get WS_URL(): string {
    const api = this.apiUrl().trim();
    if (!api) return environment.wsUrl;
    // Automatically convert http/https to ws/wss
    let ws = api.replace(/^http/, 'ws');
    // Remove trailing /api or /api/ if present
    ws = ws.replace(/\/api\/?$/, '');
    // Ensure it ends with /ws
    if (!ws.endsWith('/ws')) {
      ws = ws.replace(/\/?$/, '/ws');
    }
    return ws;
  }

  setApiUrl(url: string) {
    let formattedUrl = url.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'http://' + formattedUrl;
    }
    this.apiUrl.set(formattedUrl);
    localStorage.setItem('ping_api_url', formattedUrl);
  }

  testConnection(customUrl: string): Observable<{ success: boolean; message: string }> {
    let formattedUrl = customUrl.trim();
    if (!formattedUrl) {
      return of({ success: false, message: 'URL cannot be empty.' });
    }
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'http://' + formattedUrl;
    }
    const baseUrl = formattedUrl.replace(/\/api\/?$/, '');
    return this.http.get<{ status: string }>(`${baseUrl}/health`).pipe(
      timeout(5000),
      map(() => ({ success: true, message: 'Connected successfully!' })),
      catchError(err => {
        console.error('Connection test failed:', err);
        let msg = 'Failed to connect.';
        if (err.name === 'TimeoutError') {
          msg = 'Connection timed out (Check IP/port/firewall).';
        } else if (err.status === 0) {
          msg = 'Server unreachable (Check if server is running and Wi-Fi matches).';
        } else {
          msg = `Server error ${err.status}: ${err.statusText || 'Unknown error'}`;
        }
        return of({ success: false, message: msg });
      })
    );
  }

  // WebSocket connection
  private ws: WebSocket | null = null;
  private wsReconnectTimer: any = null;
  private wsReconnectAttempts = 0;
  private readonly WS_MAX_RECONNECT = 10;
  private readonly WS_RECONNECT_DELAY = 3000;

  // State Management
  readonly activeView = signal<'login' | 'chat' | 'settings'>('login');
  readonly currentUser = signal<UserProfile | null>(null);
  
  // Mobile responsiveness layout state
  readonly showChatMobile = signal<boolean>(false);

  // Theme state (default to purple)
  readonly selectedTheme = signal<string>('purple');

  // Add Contact drawer open state
  readonly showAddContact = signal<boolean>(false);

  private chatsSignal = signal<Chat[]>([]);
  readonly chats = this.chatsSignal.asReadonly();

  // Active chat state (starts as null so contact list shows first on mobile)
  private activeChatIdSignal = signal<number | null>(null);
  readonly activeChatId = this.activeChatIdSignal.asReadonly();

  // Search query
  readonly searchQuery = signal<string>('');

  // Selected chat details
  readonly activeChat = computed(() => {
    const id = this.activeChatIdSignal();
    return this.chatsSignal().find(c => c.id === id) || null;
  });

  // Filtered chats based on search query
  readonly filteredChats = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.chatsSignal();
    }
    return this.chatsSignal().filter(chat => 
      chat.name.toLowerCase().includes(query) || 
      chat.lastMessage.toLowerCase().includes(query)
    );
  });

  constructor() {
    this.initializeSession();
    this.setupVisibilityListener();
  }

  ngOnDestroy() {
    this.disconnectWebSocket();
  }

  setTheme(theme: string) {
    this.selectedTheme.set(theme);
    localStorage.setItem('ping_theme', theme);
  }

  private initializeSession() {
    // Load theme setting
    const savedTheme = localStorage.getItem('ping_theme') || 'purple';
    this.selectedTheme.set(savedTheme);

    // Request notification permissions
    this.requestNotificationPermission();

    const savedUser = localStorage.getItem('ping_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      this.currentUser.set(parsed);

      // Load cached chats immediately for instant UI rendering
      const cachedChats = localStorage.getItem('ping_chats');
      if (cachedChats) {
        try {
          this.chatsSignal.set(JSON.parse(cachedChats));
        } catch {}
      }

      this.activeView.set('chat');
      this.loadChats();
      this.connectWebSocket();
      this.setupPushNotifications();
      // Ensure E2E key is published on auto-login
      this.crypto.publishPublicKey(this.API_URL, this.getHeaders().headers).catch(() => {});
    } else {
      this.activeView.set('login');
    }
  }

  private setupVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.currentUser()) {
          console.log('[App] App returned to foreground. Reconnecting WebSocket and refreshing messages...');
          this.ngZone.run(() => {
            this.loadChats();
            this.connectWebSocket();
          });
        }
      });
    }
  }

  private setupPushNotifications() {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      PushNotifications.requestPermissions().then((result: any) => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      PushNotifications.addListener('registration', (token: any) => {
        console.log('[Push] Registration token:', token.value);
        this.uploadFcmToken(token.value);
      });

      PushNotifications.addListener('registrationError', (err: any) => {
        console.error('[Push] Registration error:', err);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
        console.log('[Push] Push received:', notification);
        this.ngZone.run(() => {
          this.loadChats();
        });
      });
    }
  }

  private uploadFcmToken(token: string) {
    this.http.post(`${this.API_URL}/keys/fcm-token`, { token }, this.getHeaders()).subscribe({
      next: () => console.log('[Push] FCM token uploaded successfully'),
      error: err => console.error('[Push] Upload FCM token failed:', err)
    });
  }

  private requestNotificationPermission() {
    if (typeof window !== 'undefined') {
      if (Capacitor.isNativePlatform()) {
        LocalNotifications.requestPermissions().catch(err => {
          console.error('[Notification] Error requesting native permission:', err);
        });
      } else if ('Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }
    }
  }

  private async showNotification(sender: string, text: string) {
    if (typeof window !== 'undefined') {
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await LocalNotifications.checkPermissions();
          if (perm.display === 'granted') {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: sender,
                  body: text,
                  id: Math.floor(Math.random() * 100000),
                  actionTypeId: 'OPEN_CHAT'
                }
              ]
            });
          }
        } catch (e) {
          console.error('[Notification] Native show error:', e);
        }
      } else if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(sender, {
            body: text,
            icon: 'favicon.ico'
          });
        } catch (e) {
          console.error('[Notification] Web show error:', e);
        }
      }
    }
  }

  // ──── WebSocket Connection ────

  private connectWebSocket() {
    const user = this.currentUser();
    if (!user) return;

    this.disconnectWebSocket();

    const wsUrl = `${this.WS_URL}?mobile=${encodeURIComponent(user.mobile)}`;
    
    this.ngZone.runOutsideAngular(() => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.wsReconnectAttempts = 0;
        this.ngZone.run(() => {
          this.loadChats();
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.ngZone.run(() => {
            this.handleWebSocketMessage(data);
          });
        } catch (err) {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    });
  }

  private disconnectWebSocket() {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect() {
    if (this.wsReconnectAttempts >= this.WS_MAX_RECONNECT) {
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }
    if (!this.currentUser()) return; // Don't reconnect if logged out

    this.wsReconnectAttempts++;
    this.wsReconnectTimer = setTimeout(() => {
      console.log(`[WS] Reconnecting... (attempt ${this.wsReconnectAttempts})`);
      this.connectWebSocket();
    }, this.WS_RECONNECT_DELAY);
  }

  private handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'connected':
        console.log('[WS] Server confirmed connection for:', data.mobile);
        break;

      case 'new_message':
        // Real-time message from another session/tab
        this.handleIncomingMessage(data.chatId, data.message);
        break;

      case 'chat_added':
        // A new chat was added (could be from another tab)
        this.handleChatAdded(data.chat);
        break;

      case 'pong':
        break;
    }
  }

  private async handleIncomingMessage(chatId: number, msg: Message) {
    // Try to decrypt the message using the sender's public key
    const chat = this.chatsSignal().find(c => c.id === chatId);
    const contactMobile = chat?.mobile ?? '';
    let decryptedText = msg.message;

    if (contactMobile && this.crypto.isEncrypted(msg.message)) {
      let sharedKey = await this.crypto.getSharedKey(this.API_URL, contactMobile, this.getHeaders().headers);
      if (sharedKey) {
        let result = await this.crypto.decrypt(sharedKey, msg.message);
        if (result !== null) {
          decryptedText = result;
        } else {
          // Decryption failed! The cached shared key might be stale (e.g. contact logged in from another device).
          // Clear cache and fetch fresh key from server
          console.warn(`[E2E] Decryption failed for contact ${contactMobile}. Stale cache? Retrying with fresh keys...`);
          this.crypto.clearSharedKey(contactMobile);
          sharedKey = await this.crypto.getSharedKey(this.API_URL, contactMobile, this.getHeaders().headers);
          if (sharedKey) {
            result = await this.crypto.decrypt(sharedKey, msg.message);
            if (result !== null) decryptedText = result;
          }
        }
      }
    }

    const displayMsg = { ...msg, message: decryptedText };

    this.chatsSignal.update(chats => {
      const updated = chats.map(c => {
        if (c.id === chatId) {
          const exists = c.messages.some(m => m.id === displayMsg.id);
          if (exists) return c;

          const isCurrentlyActive = this.activeChatIdSignal() === chatId;
          return {
            ...c,
            messages: [...c.messages, displayMsg],
            lastMessage: displayMsg.message,
            time: displayMsg.time,
            unreadCount: isCurrentlyActive ? 0 : c.unreadCount + 1
          };
        }
        return c;
      });
      localStorage.setItem('ping_chats', JSON.stringify(updated));
      return updated;
    });

    // Trigger local notification if app is hidden or not looking at this specific chat
    const isCurrentlyActive = this.activeChatIdSignal() === chatId;
    const isAppBackgrounded = typeof document !== 'undefined' && document.hidden;
    if (isAppBackgrounded || !isCurrentlyActive) {
      this.showNotification(displayMsg.sender, displayMsg.message);
    }
  }

  private handleChatAdded(chat: Chat) {
    const exists = this.chatsSignal().some(c => c.id === chat.id);
    if (exists) return;

    const updated = [chat, ...this.chatsSignal()];
    this.chatsSignal.set(updated);
    localStorage.setItem('ping_chats', JSON.stringify(updated));
  }

  // ──── Authenticate / Login / Signup User ────

  login(mobile: string, password: string): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.API_URL}/auth/login`, { mobile, password })
      .pipe(
        concatMap(async profile => {
          // Pre-store user profile so header/auth requests can read mobile/auth token
          localStorage.setItem('ping_user', JSON.stringify(profile));
          this.currentUser.set(profile);

          if (profile.encryptedPrivateKey && profile.publicKey) {
            try {
              console.log('[E2E] Found encrypted private key on server. Restoring...');
              const decryptedPrivateJwk = await this.crypto.decryptPrivateKey(profile.encryptedPrivateKey, password);
              
              localStorage.setItem(`ping_e2e_private_key_${profile.mobile}`, JSON.stringify(decryptedPrivateJwk));
              localStorage.setItem(`ping_e2e_public_key_${profile.mobile}`, profile.publicKey);
              
              this.crypto.clearCache();
              await this.crypto.ensureKeyPair();
              console.log('[E2E] E2E key pair successfully restored from server backup.');
            } catch (err) {
              console.error('[E2E] Failed to decrypt backed up private key:', err);
            }
          } else {
            console.log('[E2E] No backed up private key found. Generating new key pair...');
            this.crypto.clearCache();
            await this.crypto.ensureKeyPair();
            await this.crypto.publishPublicKey(this.API_URL, this.getHeaders().headers, password);
          }

          this.activeView.set('chat');
          this.requestNotificationPermission();
          this.setupPushNotifications();
          this.loadChats();
          this.connectWebSocket();
          return profile;
        })
      );
  }

  signup(name: string, email: string, mobile: string, password: string): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.API_URL}/auth/signup`, { name, email, mobile, password })
      .pipe(
        concatMap(async profile => {
          localStorage.setItem('ping_user', JSON.stringify(profile));
          this.currentUser.set(profile);

          console.log('[E2E] Generating and publishing new key pair on signup...');
          this.crypto.clearCache();
          await this.crypto.ensureKeyPair();
          await this.crypto.publishPublicKey(this.API_URL, this.getHeaders().headers, password);

          this.activeView.set('chat');
          this.requestNotificationPermission();
          this.setupPushNotifications();
          this.loadChats();
          this.connectWebSocket();
          return profile;
        })
      );
  }

  // ──── Edit Profile ────

  updateProfileName(newName: string) {
    const profile = this.currentUser();
    if (!profile) return;

    const updated = { ...profile, name: newName };
    localStorage.setItem('ping_user', JSON.stringify(updated));
    this.currentUser.set(updated);

    this.http.put(`${this.API_URL}/profile`, { name: newName }, this.getHeaders())
      .pipe(
        catchError(err => {
          console.error('Update profile failed:', err);
          if (err.status === 401) {
            this.logout();
          }
          return of(null);
        })
      ).subscribe();
  }

  // ──── Logout ────

  logout() {
    this.disconnectWebSocket();
    localStorage.removeItem('ping_user');
    localStorage.removeItem('ping_chats');
    this.currentUser.set(null);
    this.chatsSignal.set([]);
    this.activeChatIdSignal.set(null);
    this.showChatMobile.set(false);
    this.activeView.set('login');
    this.crypto.clearCache();
  }

  // ──── Load Chats ────

  private loadChats() {
    // Load from API as the primary source
    this.http.get<Chat[]>(`${this.API_URL}/chats`, this.getHeaders())
      .pipe(
        concatMap(async apiChats => {
          const chats = apiChats || [];
          // Decrypt messages for each chat
          const decrypted = await Promise.all(chats.map(async chat => {
            if (!chat.mobile) return chat;
            let sharedKey = await this.crypto.getSharedKey(this.API_URL, chat.mobile, this.getHeaders().headers);
            const messages = await Promise.all(chat.messages.map(async m => {
              if (!this.crypto.isEncrypted(m.message)) return m;
              let plain: string | null = null;
              if (sharedKey) {
                plain = await this.crypto.decrypt(sharedKey, m.message);
                if (plain === null) {
                  // Try clearing cached stale key and fetching new key from server
                  this.crypto.clearSharedKey(chat.mobile!);
                  const freshSharedKey = await this.crypto.getSharedKey(this.API_URL, chat.mobile!, this.getHeaders().headers);
                  if (freshSharedKey) {
                    plain = await this.crypto.decrypt(freshSharedKey, m.message);
                  }
                }
              }
              return { ...m, message: plain ?? m.message };
            }));
            const lastMsg = messages.length ? messages[messages.length - 1].message : chat.lastMessage;
            return { ...chat, messages, lastMessage: lastMsg };
          }));
          return decrypted;
        }),
        tap(decrypted => {
          this.chatsSignal.set(decrypted);
          localStorage.setItem('ping_chats', JSON.stringify(decrypted));
        }),
        catchError(err => {
          console.error('Load chats from API failed, trying local cache:', err);
          if (err.status === 401) {
            this.logout();
            return of(null);
          }
          // Fallback to local cache
          const cachedChats = localStorage.getItem('ping_chats');
          if (cachedChats) {
            try {
              this.chatsSignal.set(JSON.parse(cachedChats));
            } catch (e) {
              console.error('Failed to parse cached chats:', e);
            }
          }
          return of(null);
        })
      ).subscribe();
  }

  // ──── Add a new Contact by Mobile Number ────

  addContactByMobile(mobile: string): Observable<Chat | null> {
    const formattedMobile = mobile.trim();
    
    // Check if contact already exists locally
    const exists = this.chatsSignal().some(c => c.mobile === formattedMobile);
    if (exists) {
      return throwError(() => new Error('Contact already connected or in your chats.'));
    }

    // Send to API and let server create the chat (returns Chat object)
    return this.http.post<Chat>(`${this.API_URL}/chats/add`, { mobile: formattedMobile }, this.getHeaders())
      .pipe(
        tap(newChat => {
          if (newChat) {
            const updated = [newChat, ...this.chatsSignal()];
            this.chatsSignal.set(updated);
            localStorage.setItem('ping_chats', JSON.stringify(updated));
            this.selectChat(newChat.id);
          }
        }),
        catchError(err => {
          console.error('Add contact failed:', err);
          if (err.status === 401) {
            this.logout();
          }
          return throwError(() => err);
        })
      );
  }

  // ──── Select active chat ────

  selectChat(id: number) {
    this.activeChatIdSignal.set(id);
    this.showChatMobile.set(true); // Open chat view on mobile screens
    
    // Clear unread count when chat is opened
    this.chatsSignal.update(chats => {
      const updated = chats.map(c => c.id === id ? { ...c, unreadCount: 0 } : c);
      localStorage.setItem('ping_chats', JSON.stringify(updated));
      return updated;
    });
  }

  closeChatMobile() {
    this.showChatMobile.set(false);
    this.activeChatIdSignal.set(null); // Clear selected chat to show the user list
  }

  // ──── Send message ────

  async sendMessage(text: string) {
    if (!text.trim()) return;

    const currentChatId = this.activeChatIdSignal();
    if (currentChatId === null) return;

    const user = this.currentUser();
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userName = user?.name || 'User';
    const initials = userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

    // Find the contact's mobile for key lookup
    const chat = this.chatsSignal().find(c => c.id === currentChatId);
    const contactMobile = chat?.mobile ?? '';

    // Try to encrypt – silently fall back to plaintext if key not found
    let payload = text.trim();
    let isEncryptedMsg = false;
    if (contactMobile) {
      const sharedKey = await this.crypto.getSharedKey(this.API_URL, contactMobile, this.getHeaders().headers);
      if (sharedKey) {
        payload = await this.crypto.encrypt(sharedKey, text.trim());
        isEncryptedMsg = true;
      }
    }

    const tempId = Date.now();
    const newMsg: Message = {
      id: tempId,
      sender: userName,
      avatarInitials: initials,
      avatarBg: 'from-indigo-500 to-purple-500',
      message: text.trim(), // Always show plaintext in own UI
      time: timeString,
      isSelf: true
    };

    // Optimistically update UI
    this.chatsSignal.update(chats => {
      const updated = chats.map(c => {
        if (c.id === currentChatId) {
          return {
            ...c,
            messages: [...c.messages, newMsg],
            lastMessage: isEncryptedMsg ? '🔒 Encrypted message' : text.trim(),
            time: timeString
          };
        }
        return c;
      });
      localStorage.setItem('ping_chats', JSON.stringify(updated));
      return updated;
    });

    // Persist to API (send encrypted payload)
    this.http.post<Message>(`${this.API_URL}/chats/${currentChatId}/messages`, {
      message: payload,
      sender: userName,
      avatarInitials: initials,
      avatarBg: 'from-indigo-500 to-purple-500',
      time: timeString,
      isSelf: true
    }, this.getHeaders())
      .pipe(
        tap(savedMsg => {
          if (savedMsg) {
            this.chatsSignal.update(chats => {
              const updated = chats.map(c => {
                if (c.id === currentChatId) {
                  const msgs = c.messages.map(m => m.id === tempId ? { ...m, id: savedMsg.id } : m);
                  return { ...c, messages: msgs };
                }
                return c;
              });
              localStorage.setItem('ping_chats', JSON.stringify(updated));
              return updated;
            });
          }
        }),
        catchError(err => {
          console.error('Send message failed:', err);
          if (err.status === 401) {
            this.logout();
          }
          this.chatsSignal.update(chats => {
            const updated = chats.map(c => {
              if (c.id === currentChatId) {
                return { ...c, messages: c.messages.filter(m => m.id !== tempId) };
              }
              return c;
            });
            localStorage.setItem('ping_chats', JSON.stringify(updated));
            return updated;
          });
          return of(null);
        })
      ).subscribe();
  }

  // Helper headers mapping
  private getHeaders() {
    const profile = this.currentUser();
    const token = profile ? btoa(`${profile.email}:${profile.mobile}`) : '';
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Mobile': profile?.mobile || ''
      })
    };
  }
}
