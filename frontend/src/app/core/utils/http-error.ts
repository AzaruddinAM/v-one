import { HttpErrorResponse } from '@angular/common/http';

/** Extract a human friendly message from a Laravel error response. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Check your internet connection.';
    const body = err.error as { message?: string; errors?: Record<string, string[]> } | null;
    const first = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    return first ?? body?.message ?? fallback;
  }
  return fallback;
}

/** Laravel validation errors keyed by field. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (err instanceof HttpErrorResponse && err.status === 422) {
    const errors = (err.error?.errors ?? {}) as Record<string, string[]>;
    return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]]));
  }
  return {};
}
