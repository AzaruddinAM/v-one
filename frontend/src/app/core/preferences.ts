import { computed, inject } from '@angular/core';
import { Organization } from './api/models';
import { AuthStore } from './auth/auth.store';

/** Feature switches per organization (Settings → Features). Stored as JSON on the organization. */
export interface Preferences {
  /** Sortable column headers and a filter row on list tables. */
  table_filters: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  table_filters: true,
};

export function preferencesOf(org: Organization | null | undefined): Preferences {
  return { ...DEFAULT_PREFERENCES, ...(org?.preferences ?? {}) };
}

/** Signal of the current organization's preferences, for use in a component field initializer. */
export function injectPreferences() {
  const auth = inject(AuthStore);
  return computed(() => preferencesOf(auth.organization()));
}
