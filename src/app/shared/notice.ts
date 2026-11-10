import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Notice as NoticeModel } from '../core/auth.models';

@Component({
  selector: 'app-notice', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notice(); as item) {
      <div class="notice" [class]="'notice notice-' + item.tone"
        [attr.role]="item.tone === 'error' ? 'alert' : 'status'">
        <i class="bi" [class.bi-exclamation-circle]="item.tone === 'error' || item.tone === 'warning'"
          [class.bi-check-circle]="item.tone === 'success'" [class.bi-info-circle]="item.tone === 'info'" aria-hidden="true"></i>
        <span>{{ item.message }}</span>
      </div>
    }
  `,
})
export class Notice { readonly notice = input<NoticeModel | null>(null); }
