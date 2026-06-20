import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { registerPlugin, Capacitor } from '@capacitor/core';

const PingStorage = registerPlugin<{
  setItem(options: { key: string; value: string }): Promise<void>;
  getItem(options: { key: string }): Promise<{ value: string | null }>;
  removeItem(options: { key: string }): Promise<void>;
  clear(): Promise<void>;
}>('PingStorage');

async function initNativeStorage() {
  if (Capacitor.isNativePlatform()) {
    console.log('[NativeStorage] Initializing native storage mirroring...');
    
    const keysToLoad = [
      'ping_user',
      'ping_theme',
      'ping_chats',
      'ping_api_url',
      'ping_e2e_private_key',
      'ping_e2e_public_key'
    ];

    for (const key of keysToLoad) {
      try {
        const { value } = await PingStorage.getItem({ key });
        if (value !== null) {
          localStorage.setItem(key, value);
          console.log(`[NativeStorage] Loaded ${key} from native preferences`);
        }
      } catch (e) {
        console.error(`[NativeStorage] Error loading ${key}:`, e);
      }
    }

    // Dynamically load user-specific E2E keys if a user is logged in
    const savedUser = localStorage.getItem('ping_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        const mobile = user.mobile;
        if (mobile) {
          const userSpecificKeys = [
            `ping_e2e_private_key_${mobile}`,
            `ping_e2e_public_key_${mobile}`
          ];
          for (const key of userSpecificKeys) {
            const { value } = await PingStorage.getItem({ key });
            if (value !== null) {
              localStorage.setItem(key, value);
              console.log(`[NativeStorage] Loaded user-specific key ${key} from native preferences`);
            }
          }
        }
      } catch (e) {
        console.error('[NativeStorage] Error loading user-specific E2E keys:', e);
      }
    }

    // Monkey-patch localStorage to mirror changes to native storage
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const originalClear = localStorage.clear.bind(localStorage);

    localStorage.setItem = (key: string, value: string) => {
      originalSetItem(key, value);
      PingStorage.setItem({ key, value }).catch(err => {
        console.error(`[NativeStorage] Error setting ${key} in native storage:`, err);
      });
    };

    localStorage.removeItem = (key: string) => {
      originalRemoveItem(key);
      PingStorage.removeItem({ key }).catch(err => {
        console.error(`[NativeStorage] Error removing ${key} from native storage:`, err);
      });
    };

    localStorage.clear = () => {
      originalClear();
      PingStorage.clear().catch(err => {
        console.error('[NativeStorage] Error clearing native storage:', err);
      });
    };
  }
}

initNativeStorage().then(() => {
  bootstrapApplication(App, appConfig)
    .catch((err) => console.error(err));
});

