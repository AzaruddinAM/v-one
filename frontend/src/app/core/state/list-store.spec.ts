import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signalStore } from '@ngrx/signals';
import { environment } from '../../../environments/environment';
import { withPaginatedList } from './list-store';

interface Row {
  id: number;
  name: string;
}
const TestStore = signalStore(withPaginatedList<Row>('contacts', { type: 'customer' }));
const page = (data: Row[], current = 1, last = 1, total = data.length) => ({ data, current_page: current, last_page: last, per_page: 20, total });

describe('withPaginatedList', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof TestStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), TestStore] });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(TestStore);
  });
  afterEach(() => http.verify());

  const expectList = (query: string) => http.expectOne((r) => r.url === `${environment.apiUrl}/contacts` && r.params.toString() === query);

  it('loads entities with filters and pagination metadata', () => {
    store.load();
    expect(store.loading()).toBe(true);
    expectList('type=customer&page=1&per_page=20').flush(page([{ id: 1, name: 'A' }, { id: 2, name: 'B' }], 1, 3, 45));
    expect(store.entities().map((e) => e.name)).toEqual(['A', 'B']);
    expect(store.total()).toBe(45);
    expect(store.lastPage()).toBe(3);
    expect(store.rangeLabel()).toBe('1–20 of 45');
    expect(store.loading()).toBe(false);
  });

  it('resets to page 1 when filters change and drops empty params', () => {
    store.load();
    expectList('type=customer&page=1&per_page=20').flush(page([], 1, 3, 45));
    store.goTo(2);
    expectList('type=customer&page=2&per_page=20').flush(page([{ id: 3, name: 'C' }], 2, 3, 45));
    store.setFilters({ active: 1, q: '' });
    expectList('type=customer&active=1&page=1&per_page=20').flush(page([]));
    expect(store.isEmpty()).toBe(true);
  });

  it('ignores out-of-range page requests', () => {
    store.load();
    expectList('type=customer&page=1&per_page=20').flush(page([{ id: 1, name: 'A' }]));
    store.goTo(0);
    store.goTo(2);
    http.expectNone(() => true);
  });

  it('removes optimistically and reloads + reports on failure', () => {
    store.load();
    expectList('type=customer&page=1&per_page=20').flush(page([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]));
    const onError = vi.fn();
    store.remove(1, onError);
    expect(store.ids()).toEqual([2]);
    http.expectOne(`${environment.apiUrl}/contacts/1`).flush({ message: 'Has transactions' }, { status: 422, statusText: 'x' });
    expect(onError).toHaveBeenCalledWith('Has transactions');
    expectList('type=customer&page=1&per_page=20').flush(page([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]));
    expect(store.ids()).toEqual([1, 2]);
  });

  it('captures load errors', () => {
    store.load();
    expectList('type=customer&page=1&per_page=20').flush({ message: 'Server exploded' }, { status: 500, statusText: 'x' });
    expect(store.error()).toBe('Server exploded');
  });
});
