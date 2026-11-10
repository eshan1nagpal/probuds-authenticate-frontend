import { DOCUMENT } from '@angular/common';
import { HttpContextToken, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root', factory: () => environment.apiBaseUrl.replace(/\/+$/, ''),
});

// Login/password errors belong to their forms; logout handles revocation errors itself.
export const HANDLE_AUTH_ERRORS_LOCALLY = new HttpContextToken<boolean>(() => false);
export const API_PATHS = {
  portal: '/portal', moduleLaunch: '/portal/launch',
  login: '/authenticate', session: '/session', password: '/password/change', logout: '/deout',
  resetRequest: '/password/reset/request', resetConfirm: '/password/reset/confirm',
} as const;

export function isApiUrl(url: string, apiBase: string, documentBase: string): boolean {
  const target = new URL(url, documentBase);
  const api = new URL(apiBase, documentBase);
  const path = api.pathname.replace(/\/+$/, '');
  return target.origin === api.origin
    && (target.pathname === path || target.pathname.startsWith(`${path}/`));
}

export function basicHeaders(username: string, password: string): HttpHeaders {
  // UTF-8 matches Spring's Basic authentication decoding; never trim password characters.
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
  return new HttpHeaders({ Authorization: `Basic ${encoded}` });
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  readonly baseUrl = inject(API_BASE_URL);
  readonly document = inject(DOCUMENT);

  url(path: string): string { return `${this.baseUrl}${path}`; }

  contains(url: string): boolean {
    return isApiUrl(url, this.baseUrl, this.document.baseURI);
  }

  isCredentialUrl(url: string): boolean {
    const path = new URL(url, this.document.baseURI).pathname;
    return [API_PATHS.login, API_PATHS.password].some(endpoint =>
      path === new URL(this.url(endpoint), this.document.baseURI).pathname);
  }

  isPublicUrl(url: string): boolean {
    const path = new URL(url, this.document.baseURI).pathname;
    return [API_PATHS.resetRequest, API_PATHS.resetConfirm].some(endpoint =>
      path === new URL(this.url(endpoint), this.document.baseURI).pathname);
  }
}
