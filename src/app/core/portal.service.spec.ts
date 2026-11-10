import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalService, PopupBlockedError } from './portal.service';
import { API_BASE_URL } from './api';
import { authInterceptor } from './auth-interceptor';
import { SessionStore } from './session-store';

describe('module launcher', () => {
  let http: HttpTestingController;
  let popup: Window;
  let popupDocument: Document;
  let close: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/api' }] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).token.set('portal-bearer');
    popupDocument = document.implementation.createHTMLDocument('');
    close = vi.fn();
    popup = { document: popupDocument, close, closed: false, opener: window } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); sessionStorage.clear(); });

  it('opens synchronously then posts only a one-use ticket into the new tab', () => {
    let done = false;
    TestBed.inject(PortalService).launch('FCM').subscribe(() => { done = true; });
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(popup.opener).toBeNull();
    const request = http.expectOne('/api/portal/modules/FCM/launch');
    expect(request.request.headers.get('Authorization')).toBe('Bearer portal-bearer');
    request.flush({ ticket: 'x'.repeat(43) });
    const form = popupDocument.querySelector('form')!;
    expect(form.method).toBe('post'); expect(form.action).toBe(new URL('/api/portal/launch', document.baseURI).href);
    expect(form.querySelectorAll('input').length).toBe(1);
    expect(form.querySelector('input')?.name).toBe('ticket');
    expect(form.querySelector('input')?.value).toBe('x'.repeat(43));
    expect(popupDocument.body.innerHTML).not.toContain('portal-bearer');
    expect(HTMLFormElement.prototype.submit).toHaveBeenCalled(); expect(done).toBe(true); expect(close).not.toHaveBeenCalled();
  });
  it('reports a blocked popup before requesting a ticket', () => {
    vi.mocked(window.open).mockReturnValue(null);
    let error: unknown;
    TestBed.inject(PortalService).launch('FCM').subscribe({ error: value => { error = value; } });
    expect(error).toBeInstanceOf(PopupBlockedError); http.expectNone('/api/portal/modules/FCM/launch');
  });
  it('closes an abandoned tab on request failure or invalid launch data', () => {
    TestBed.inject(PortalService).launch('FCM').subscribe({ error: () => undefined });
    http.expectOne('/api/portal/modules/FCM/launch').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(close).toHaveBeenCalledTimes(1);
    TestBed.inject(PortalService).launch('FCM').subscribe({ error: () => undefined });
    http.expectOne('/api/portal/modules/FCM/launch').flush({ ticket: '<bad>' });
    expect(close).toHaveBeenCalledTimes(2); expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
  });
});
