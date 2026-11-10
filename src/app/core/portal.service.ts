import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, finalize, map, Observable, tap } from 'rxjs';
import { API_PATHS, AuthApi } from './api';

export interface PortalModule { id: string; name: string; logo: string; }
export interface PortalResponse {
  modules: PortalModule[];
  adminTaskEnabled: boolean;
  changePasswordEnabled: boolean;
}
export class PopupBlockedError extends Error {}

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(AuthApi);
  private readonly document = inject(DOCUMENT);

  load(): Observable<PortalResponse> { return this.http.get<PortalResponse>(this.api.url(API_PATHS.portal)); }

  launch(id: string): Observable<void> {
    return defer(() => {
      // Open during the user's click, before the asynchronous request triggers popup blocking.
      const popup = this.document.defaultView?.open('about:blank', '_blank');
      if (!popup) throw new PopupBlockedError();
      popup.opener = null;
      popup.document.title = 'Opening application | e-Compliance';
      popup.document.body.textContent = 'Opening your application…';
      let submitted = false;
      return this.http.post<{ ticket: string }>(
        this.api.url(`${API_PATHS.portal}/modules/${encodeURIComponent(id)}/launch`), {},
      ).pipe(
        tap(({ ticket }) => {
          if (popup.closed || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new Error('Launch unavailable');
          // Post only the one-use capability. The backend supplies downstream credentials.
          const form = popup.document.createElement('form');
          form.method = 'POST';
          form.action = new URL(this.api.url(API_PATHS.moduleLaunch), this.document.baseURI).href;
          const input = popup.document.createElement('input');
          input.type = 'hidden'; input.name = 'ticket'; input.value = ticket;
          form.appendChild(input);
          popup.document.body.replaceChildren(form);
          form.submit();
          submitted = true;
        }),
        map(() => undefined),
        finalize(() => { if (!submitted) popup.close(); }),
      );
    });
  }
}
