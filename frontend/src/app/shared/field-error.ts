import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/** Shows client-side validation or a server (422) message under a form field. */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    @if (message(); as m) {
      <small class="field-error">{{ m }}</small>
    }
  `,
})
export class FieldError {
  readonly control = input<AbstractControl | null>(null);
  readonly server = input<string | undefined>(undefined);
  readonly label = input('This field');

  message(): string | null {
    const c = this.control();
    if (c && c.invalid && (c.touched || c.dirty)) {
      const e = c.errors ?? {};
      if (e['required']) return `${this.label()} is required.`;
      if (e['email']) return 'Enter a valid email address.';
      if (e['pattern']) return `${this.label()} format is invalid.`;
      if (e['minlength']) return `${this.label()} must be at least ${e['minlength'].requiredLength} characters.`;
      if (e['min']) return `${this.label()} must be at least ${e['min'].min}.`;
      if (e['max']) return `${this.label()} must be at most ${e['max'].max}.`;
      if (e['mismatch']) return 'Passwords do not match.';
    }
    return this.server() ?? null;
  }
}
