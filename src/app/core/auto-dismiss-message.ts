import { DestroyRef, signal } from '@angular/core';

/** Restarts the dismissal window for each success, including repeated identical messages. */
export class AutoDismissMessage {
  private readonly state = signal<string | null>(null);
  readonly message = this.state.asReadonly();
  private timeout: ReturnType<typeof setTimeout> | undefined;

  constructor(destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => this.cancel());
  }

  set(message: string | null): void {
    this.cancel();
    this.state.set(message);
    if (message !== null) {
      this.timeout = setTimeout(() => {
        this.timeout = undefined;
        this.state.set(null);
      }, 5000);
    }
  }

  private cancel(): void {
    if (this.timeout !== undefined) clearTimeout(this.timeout);
    this.timeout = undefined;
  }
}
