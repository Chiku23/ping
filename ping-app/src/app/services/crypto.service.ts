import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * E2E Encryption Service using Web Crypto API (ECDH + AES-GCM)
 *
 * How it works:
 *  1. On first login, generate an ECDH P-256 key pair.
 *  2. Store the private key in localStorage (as JWK).
 *  3. Upload the public key (as JWK JSON string) to the server.
 *  4. Before sending a message, fetch the contact's public key,
 *     derive a shared AES-GCM key via ECDH, then encrypt the plaintext.
 *  5. On receive, derive the same shared key and decrypt.
 *
 *  The server only ever sees ciphertext — it cannot decrypt messages.
 */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  private http = inject(HttpClient);

  // In-memory cache of derived AES-GCM shared keys per contact mobile
  private sharedKeyCache = new Map<string, CryptoKey>();

  // Our own ECDH key pair (loaded once per session)
  private ownKeyPair: CryptoKeyPair | null = null;

  // Safe getter for Web Crypto subtle API (only available in secure contexts)
  private get cryptoSubtle(): SubtleCrypto | null {
    if (typeof window !== 'undefined' && window.crypto) {
      return window.crypto.subtle || null;
    }
    return null;
  }

  private getCurrentUserMobile(): string | null {
    const savedUser = localStorage.getItem('ping_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        return parsed.mobile || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  // ──── Key Generation & Persistence ────

  async ensureKeyPair(): Promise<CryptoKeyPair | null> {
    if (this.ownKeyPair) return this.ownKeyPair;

    const subtle = this.cryptoSubtle;
    if (!subtle) {
      console.warn('[E2E] Web Crypto (crypto.subtle) is not available. E2E requires a Secure Context (HTTPS or localhost).');
      return null;
    }

    const mobile = this.getCurrentUserMobile();
    if (!mobile) {
      console.warn('[E2E] Cannot ensure key pair: No logged in user found.');
      return null;
    }

    const privateKeyName = `ping_e2e_private_key_${mobile}`;
    const publicKeyName = `ping_e2e_public_key_${mobile}`;

    // Migration: if user has generic keys, migrate them to user-specific keys
    if (!localStorage.getItem(privateKeyName) && localStorage.getItem('ping_e2e_private_key')) {
      const oldPrivate = localStorage.getItem('ping_e2e_private_key');
      const oldPublic = localStorage.getItem('ping_e2e_public_key');
      if (oldPrivate && oldPublic) {
        localStorage.setItem(privateKeyName, oldPrivate);
        localStorage.setItem(publicKeyName, oldPublic);
        localStorage.removeItem('ping_e2e_private_key');
        localStorage.removeItem('ping_e2e_public_key');
      }
    }

    const savedPrivateJwk = localStorage.getItem(privateKeyName);
    const savedPublicJwk  = localStorage.getItem(publicKeyName);

    if (savedPrivateJwk && savedPublicJwk) {
      try {
        const privateKey = await subtle.importKey(
          'jwk',
          JSON.parse(savedPrivateJwk),
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          ['deriveKey']
        );
        const publicKey = await subtle.importKey(
          'jwk',
          JSON.parse(savedPublicJwk),
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          []
        );
        this.ownKeyPair = { privateKey, publicKey };
      } catch (err) {
        console.error('[E2E] Failed to import stored E2E keys:', err);
        // Clear corrupt keys
        localStorage.removeItem(privateKeyName);
        localStorage.removeItem(publicKeyName);
      }
    }

    if (!this.ownKeyPair) {
      try {
        this.ownKeyPair = await subtle.generateKey(
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          ['deriveKey']
        ) as CryptoKeyPair;
        // Persist both halves
        const privateJwk = await subtle.exportKey('jwk', this.ownKeyPair.privateKey);
        const publicJwk  = await subtle.exportKey('jwk', this.ownKeyPair.publicKey);
        localStorage.setItem(privateKeyName, JSON.stringify(privateJwk));
        localStorage.setItem(publicKeyName,  JSON.stringify(publicJwk));
      } catch (err) {
        console.error('[E2E] Failed to generate E2E keypair:', err);
        return null;
      }
    }

    return this.ownKeyPair;
  }

  /** Returns own public key as a JSON string for uploading to the server */
  async getOwnPublicKeyString(): Promise<string | null> {
    const subtle = this.cryptoSubtle;
    if (!subtle) return null;

    const pair = await this.ensureKeyPair();
    if (!pair) return null;

    const jwk = await subtle.exportKey('jwk', pair.publicKey);
    return JSON.stringify(jwk);
  }

  /** Upload our public key (and optionally encrypted private key) to the backend */
  async publishPublicKey(apiUrl: string, headers: HttpHeaders, password?: string): Promise<void> {
    try {
      const subtle = this.cryptoSubtle;
      if (!subtle) {
        console.warn('[E2E] Skipping key publication: secure context/Web Crypto unavailable.');
        return;
      }

      const pair = await this.ensureKeyPair();
      if (!pair) return;

      const publicJwk = await subtle.exportKey('jwk', pair.publicKey);
      const publicKeyStr = JSON.stringify(publicJwk);

      let encryptedPrivateKeyStr: string | undefined = undefined;
      if (password) {
        const privateJwk = await subtle.exportKey('jwk', pair.privateKey);
        encryptedPrivateKeyStr = await this.encryptPrivateKey(privateJwk, password);
      }

      await firstValueFrom(
        this.http.put(`${apiUrl}/keys/public`, {
          publicKey: publicKeyStr,
          encryptedPrivateKey: encryptedPrivateKeyStr
        }, { headers })
      );
      console.log('[E2E] Successfully published E2E keys to backend.');
    } catch (err) {
      console.error('[E2E] Failed to publish E2E keys:', err);
    }
  }

  // ──── Shared Key Derivation ────

  private async fetchContactPublicKey(apiUrl: string, contactMobile: string, headers: HttpHeaders): Promise<CryptoKey | null> {
    const subtle = this.cryptoSubtle;
    if (!subtle) return null;

    const res: any = await firstValueFrom(
      this.http.get(`${apiUrl}/keys/${encodeURIComponent(contactMobile)}`, { headers })
    );
    if (!res || !res.publicKey) return null;
    const jwk = JSON.parse(res.publicKey);
    return subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
  }

  async getSharedKey(apiUrl: string, contactMobile: string, headers: HttpHeaders): Promise<CryptoKey | null> {
    if (this.sharedKeyCache.has(contactMobile)) {
      return this.sharedKeyCache.get(contactMobile)!;
    }
    const subtle = this.cryptoSubtle;
    if (!subtle) return null;

    try {
      const pair = await this.ensureKeyPair();
      if (!pair) return null;

      const theirPublicKey = await this.fetchContactPublicKey(apiUrl, contactMobile, headers);
      if (!theirPublicKey) return null;

      const sharedKey = await subtle.deriveKey(
        { name: 'ECDH', public: theirPublicKey },
        pair.privateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      this.sharedKeyCache.set(contactMobile, sharedKey);
      console.log(`[E2E] Successfully derived shared key for contact: ${contactMobile}`);
      return sharedKey;
    } catch (err) {
      console.warn(`[E2E] Could not derive shared key for ${contactMobile} (falling back to plaintext):`, err);
      return null;
    }
  }

  // ──── Encrypt / Decrypt ────

  /**
   * Encrypts a plaintext string.
   * Returns a base64 string: "<iv_base64>.<ciphertext_base64>"
   */
  async encrypt(sharedKey: CryptoKey, plaintext: string): Promise<string> {
    const subtle = this.cryptoSubtle;
    if (!subtle) return plaintext;

    const cryptoObj = window.crypto || (window as any).msCrypto;
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuffer = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      encoded
    );
    const ivB64     = btoa(String.fromCharCode(...iv));
    const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
    return `${ivB64}.${cipherB64}`;
  }

  /**
   * Decrypts an encrypted message in "<iv_base64>.<ciphertext_base64>" format.
   * Returns null if decryption fails (e.g. key mismatch or plaintext message).
   */
  async decrypt(sharedKey: CryptoKey, ciphertext: string): Promise<string | null> {
    const subtle = this.cryptoSubtle;
    if (!subtle) return null;

    try {
      const [ivB64, cipherB64] = ciphertext.split('.');
      if (!ivB64 || !cipherB64) return null;
      const iv     = Uint8Array.from(atob(ivB64),     c => c.charCodeAt(0));
      const cipher = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
      const plainBuffer = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        cipher
      );
      return new TextDecoder().decode(plainBuffer);
    } catch {
      return null; // could not decrypt — maybe legacy plaintext
    }
  }

  /** Checks if a message string looks like an encrypted payload */
  isEncrypted(message: string): boolean {
    // Encrypted messages always follow "<base64>.<base64>" format
    return /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(message) && message.includes('.');
  }

  /** Clear cached keys (e.g. on logout) */
  clearCache(): void {
    this.sharedKeyCache.clear();
    this.ownKeyPair = null;
  }

  clearSharedKey(contactMobile: string): void {
    this.sharedKeyCache.delete(contactMobile);
  }

  private async deriveAesKey(password: string): Promise<CryptoKey> {
    const subtle = this.cryptoSubtle;
    if (!subtle) throw new Error('Web Crypto API not available');
    const passwordBuffer = new TextEncoder().encode(password);
    const hashBuffer = await subtle.digest('SHA-256', passwordBuffer);
    return subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptPrivateKey(privateJwk: any, password: string): Promise<string> {
    const subtle = this.cryptoSubtle;
    if (!subtle) throw new Error('Web Crypto API not available');
    const key = await this.deriveAesKey(password);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(privateJwk));
    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );
    const ivB64 = btoa(String.fromCharCode(...iv));
    const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    return `${ivB64}.${cipherB64}`;
  }

  async decryptPrivateKey(encryptedData: string, password: string): Promise<any> {
    const subtle = this.cryptoSubtle;
    if (!subtle) throw new Error('Web Crypto API not available');
    const [ivB64, cipherB64] = encryptedData.split('.');
    if (!ivB64 || !cipherB64) throw new Error('Invalid encrypted private key format');
    const key = await this.deriveAesKey(password);
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipher
    );
    const plainText = new TextDecoder().decode(plainBuffer);
    return JSON.parse(plainText);
  }
}
