import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-shell', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth-background">
      <div class="auth-container" [class.auth-container-wide]="wide()">
        <section class="auth-card card" [attr.aria-labelledby]="headingId()">
          <div class="auth-brand"><img src="assets/images/e-comp.png" alt="e-Compliance Suite" width="234" height="82"></div>
          <div class="auth-intro"><span class="eyebrow">ACCOUNT ACCESS</span>
            <h1 [id]="headingId()">{{ title() }}</h1><p>{{ description() }}</p>
          </div>
          <ng-content />
        </section>
        <p class="auth-footer">e-Compliance Suite <span aria-hidden="true">·</span> Account portal</p>
      </div>
    </main>
  `,
})
export class AuthShell {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly headingId = input('page-title');
  readonly wide = input(false);
}
