import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-auth-hero',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="hero__brand"><img src="favicon.svg" alt="" width="40" height="40" /> v-one</div>
    <div class="hero__body">
      <h2>Accounting that keeps up with your business.</h2>
      <p>Invoices, bills, inventory, GST and reports — all in one place, for every kind of product and service.</p>
      <ul>
        <li><app-icon name="check" /> Professional GST-ready invoices & estimates</li>
        <li><app-icon name="check" /> Real-time stock tracking across purchases and sales</li>
        <li><app-icon name="check" /> Receivables, payables & expense tracking</li>
        <li><app-icon name="check" /> Profit & Loss, Balance Sheet and tax reports</li>
      </ul>
    </div>
    <div class="hero__foot">© {{ year }} v-one. Secure by design.</div>
  `,
  styleUrl: './hero.scss',
})
export class AuthHero {
  protected readonly year = new Date().getFullYear();
}
