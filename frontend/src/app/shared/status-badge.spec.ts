import { TestBed } from '@angular/core/testing';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders a human label with a tone', async () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', 'overdue');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement.querySelector('.badge');
    expect(el.textContent?.trim()).toBe('overdue');
    expect(el.dataset['tone']).toBe('danger');

    fixture.componentRef.setInput('status', 'sales_order');
    await fixture.whenStable();
    expect(el.textContent?.trim()).toBe('sales order');
    expect(el.dataset['tone']).toBe('neutral');
  });
});
