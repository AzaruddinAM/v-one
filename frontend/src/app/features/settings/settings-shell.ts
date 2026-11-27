import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-settings-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Settings" subtitle="Organization, taxes, numbering, PDF templates, users and your profile." />
    <nav class="tabs">
      <a routerLink="organization" routerLinkActive="is-active">Organization</a>
      <a routerLink="taxes" routerLinkActive="is-active">Taxes</a>
      <a routerLink="numbering" routerLinkActive="is-active">Transaction numbers</a>
      <a routerLink="pdf" routerLinkActive="is-active">PDF templates</a>
      @if (auth.isAdmin()) { <a routerLink="users" routerLinkActive="is-active">Users & roles</a> }
      <a routerLink="profile" routerLinkActive="is-active">My profile</a>
    </nav>
    <router-outlet />
  `,
})
export class SettingsShell {
  protected readonly auth = inject(AuthStore);
}
