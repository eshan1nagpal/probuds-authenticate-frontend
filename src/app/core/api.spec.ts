import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL, isApiUrl } from './api';
import { authInterceptor } from './auth-interceptor';
import { SessionStore } from './session-store';

describe('API request boundaries', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), provideRouter([]), { provide: API_BASE_URL, useValue: '/api' }] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); sessionStorage.clear(); });

  it('matches only the configured API origin and path prefix', () => {
    expect(isApiUrl('/api/session', '/api', 'https://example.test/')).toBe(true);
    expect(isApiUrl('/api-other/session', '/api', 'https://example.test/')).toBe(false);
    expect(isApiUrl('https://external.test/api/session', '/api', 'https://example.test/')).toBe(false);
    expect(isApiUrl('/assets/logo.png', '/api', 'https://example.test/')).toBe(false);
  });

  it.each(['/assets/logo.png', '/api-other/session', 'https://external.test/api/session'])(
    'does not leak bearer credentials or fingerprints to %s', url => {
      const store = TestBed.inject(SessionStore);
      store.token.set('test-token');
      TestBed.inject(HttpClient).get(url).subscribe();
      const request = TestBed.inject(HttpTestingController).expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.headers.has('Application')).toBe(false);
      expect(request.request.headers.has('X-Session-Fingerprint')).toBe(false);
      request.flush({});
    });
});
