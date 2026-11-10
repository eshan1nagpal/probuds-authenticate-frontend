import { computed, Injectable, signal } from '@angular/core';
import { AuthenticationResponse, CurrentUser, Notice } from './auth.models';
import { AuthClientError } from './auth.messages';

export const SESSION_KEY = 'probuds_auth_session';
export const FINGERPRINT_KEY = 'probuds_auth_fingerprint';

interface StoredSession {
  token: string;
  expiresAt: number;
  passwordExpiryDate: string | null;
  passwordExpiresInDays: number | null;
}

@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly token = signal<string | null>(null);
  readonly user = signal<CurrentUser | null>(null);
  readonly passwordExpiryDate = signal<string | null>(null);
  readonly passwordExpiresInDays = signal<number | null>(null);
  readonly notice = signal<Notice | null>(null);
  readonly pendingUsername = signal('');
  readonly passwordChangeRequired = signal(false);
  readonly hasToken = computed(() => !!this.token());

  constructor() {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
      if (this.isStoredSession(saved) && sessionStorage.getItem(FINGERPRINT_KEY)) {
        this.token.set(saved.token);
        this.passwordExpiryDate.set(saved.passwordExpiryDate);
        this.passwordExpiresInDays.set(saved.passwordExpiresInDays);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      this.notice.set({ tone: 'warning', message: 'Your saved session could not be loaded. Please sign in again.' });
    }
  }

  fingerprint(): string {
    try {
      let value = sessionStorage.getItem(FINGERPRINT_KEY);
      if (!value) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        value = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem(FINGERPRINT_KEY, value);
      }
      return value;
    } catch { throw new AuthClientError('storage'); }
  }

  saveLogin(response: AuthenticationResponse): void {
    if (!response.status || response.outcome !== 'AUTHENTICATED' || !response.accessToken
      || typeof response.expiresIn !== 'number' || !Number.isFinite(response.expiresIn) || response.expiresIn <= 0) {
      throw new AuthClientError('response');
    }
    const stored: StoredSession = {
      token: response.accessToken, expiresAt: Date.now() + response.expiresIn * 1000,
      passwordExpiryDate: response.passwordExpiryDate ?? null,
      passwordExpiresInDays: response.passwordExpiresInDays ?? null,
    };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored)); }
    catch { throw new AuthClientError('storage'); }
    this.token.set(stored.token);
    this.passwordExpiryDate.set(stored.passwordExpiryDate);
    this.passwordExpiresInDays.set(stored.passwordExpiresInDays);
    this.passwordChangeRequired.set(false);
    this.pendingUsername.set('');
  }

  setUser(response: AuthenticationResponse): void {
    if (!response.status || !response.username) throw new AuthClientError('response');
    this.user.set({ username: response.username, name: response.name || response.username,
      roles: response.roles?.filter(role => typeof role === 'string') ?? [] });
  }

  clear(): void {
    this.token.set(null);
    this.user.set(null);
    this.passwordExpiryDate.set(null);
    this.passwordExpiresInDays.set(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(FINGERPRINT_KEY);
    } catch { /* In-memory credentials are cleared even when browser storage is unavailable. */ }
  }

  private isStoredSession(value: unknown): value is StoredSession {
    if (typeof value !== 'object' || value === null) return false;
    const saved = value as Partial<StoredSession>;
    return typeof saved.token === 'string' && saved.token.length > 0
      && typeof saved.expiresAt === 'number' && Number.isFinite(saved.expiresAt)
      && (saved.passwordExpiryDate === null || typeof saved.passwordExpiryDate === 'string')
      && (saved.passwordExpiresInDays === null || typeof saved.passwordExpiresInDays === 'number');
  }
}
