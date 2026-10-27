import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

/** Promise-based confirm dialog rendered once by the shell (no native confirm()). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);

  ask(title: string, message: string, opts: { confirmText?: string; danger?: boolean } = {}): Promise<boolean> {
    return new Promise((resolve) => {
      this.current.set({ title, message, ...opts, resolve });
    });
  }

  close(ok: boolean): void {
    this.current()?.resolve(ok);
    this.current.set(null);
  }
}
