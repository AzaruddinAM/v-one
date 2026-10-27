import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../core/auth/auth.store';
import { LookupsStore } from '../core/state/lookups.store';
import { Icon } from '../shared/icon';

interface NavItem {
  label: string;
  icon: string;
  link: string;
}
interface NavGroup {
  title?: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <aside class="sidebar" [class.is-open]="menuOpen()">
      <a routerLink="/dashboard" class="brand">
        <img src="favicon.svg" alt="" width="32" height="32" />
        <span>v-one</span>
      </a>
      <nav>
        @for (group of nav; track $index) {
          @if (group.title) {
            <div class="nav-title">{{ group.title }}</div>
          }
          @for (item of group.items; track item.link) {
            <a [routerLink]="item.link" routerLinkActive="is-active" class="nav-link">
              <app-icon [name]="item.icon" />
              <span>{{ item.label }}</span>
            </a>
          }
        }
      </nav>
      <div class="sidebar__footer">
        <a routerLink="/settings" routerLinkActive="is-active" class="nav-link"><app-icon name="settings" /><span>Settings</span></a>
      </div>
    </aside>
    @if (menuOpen()) {
      <div class="scrim" (click)="menuOpen.set(false)"></div>
    }

    <div class="main-wrap">
      <header class="topbar">
        <button type="button" class="btn btn--ghost btn--icon menu-btn" (click)="menuOpen.set(!menuOpen())" aria-label="Toggle menu">
          <app-icon name="menu" />
        </button>
        <div class="org">
          <app-icon name="building" />
          <span>{{ auth.organization()?.name }}</span>
        </div>
        <div class="spacer"></div>
        <div class="quick">
          <a routerLink="/sales/invoices/new" class="btn btn--sm"><app-icon name="plus" [size]="16" /> <span class="hide-sm">New Invoice</span></a>
        </div>
        <div class="user" (click)="userMenu.set(!userMenu())">
          <div class="avatar">{{ auth.initials() }}</div>
          <div class="user__meta hide-sm">
            <strong>{{ auth.user()?.name }}</strong>
            <small>{{ auth.role() }}</small>
          </div>
          <app-icon name="chevron-down" [size]="16" />
          @if (userMenu()) {
            <div class="dropdown" (click)="$event.stopPropagation()">
              <a routerLink="/settings/profile" (click)="userMenu.set(false)"><app-icon name="user" /> My profile</a>
              <a routerLink="/settings/organization" (click)="userMenu.set(false)"><app-icon name="building" /> Organization</a>
              <button type="button" (click)="auth.logout()"><app-icon name="logout" /> Sign out</button>
            </div>
          }
        </div>
      </header>
      <main class="main">
        <router-outlet />
      </main>
    </div>
  `,
  host: { '(document:click)': 'onDocClick($event)' },
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  private readonly lookups = inject(LookupsStore);
  protected readonly menuOpen = signal(false);
  protected readonly userMenu = signal(false);

  protected readonly nav: NavGroup[] = [
    { items: [{ label: 'Dashboard', icon: 'dashboard', link: '/dashboard' }] },
    {
      title: 'Contacts',
      items: [
        { label: 'Customers', icon: 'users', link: '/customers' },
        { label: 'Vendors', icon: 'truck', link: '/vendors' },
      ],
    },
    { title: 'Inventory', items: [{ label: 'Items', icon: 'box', link: '/items' }] },
    {
      title: 'Sales',
      items: [
        { label: 'Estimates', icon: 'estimate', link: '/sales/estimates' },
        { label: 'Sales Orders', icon: 'cart', link: '/sales/orders' },
        { label: 'Invoices', icon: 'invoice', link: '/sales/invoices' },
        { label: 'Payments Received', icon: 'card', link: '/payments/received' },
        { label: 'Credit Notes', icon: 'return', link: '/sales/credit-notes' },
      ],
    },
    {
      title: 'Purchases',
      items: [
        { label: 'Purchase Orders', icon: 'cart', link: '/purchases/orders' },
        { label: 'Bills', icon: 'receipt', link: '/purchases/bills' },
        { label: 'Payments Made', icon: 'card', link: '/payments/made' },
        { label: 'Expenses', icon: 'wallet', link: '/expenses' },
      ],
    },
    {
      title: 'Accountant',
      items: [
        { label: 'Chart of Accounts', icon: 'book', link: '/accounting/accounts' },
        { label: 'Manual Journals', icon: 'journal', link: '/accounting/journals' },
        { label: 'Reports', icon: 'chart', link: '/reports' },
      ],
    },
  ];

  constructor() {
    // Fresh reference data for this session / organization.
    this.lookups.load({ force: true });
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        this.menuOpen.set(false);
        this.userMenu.set(false);
      });
  }

  protected onDocClick(e: MouseEvent): void {
    if (this.userMenu() && !(e.target as HTMLElement).closest('.user')) this.userMenu.set(false);
  }
}
