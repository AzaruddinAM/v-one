import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guards';
import { DocumentType } from './core/api/models';

const docRoutes = (path: string, type: DocumentType): Routes => [
  { path, data: { docType: type }, loadComponent: () => import('./features/documents/document-list').then((m) => m.DocumentList) },
  { path: `${path}/new`, data: { docType: type }, loadComponent: () => import('./features/documents/document-form').then((m) => m.DocumentForm) },
  { path: `${path}/:id`, data: { docType: type }, loadComponent: () => import('./features/documents/document-view').then((m) => m.DocumentView) },
  { path: `${path}/:id/edit`, data: { docType: type }, loadComponent: () => import('./features/documents/document-form').then((m) => m.DocumentForm) },
];

/** Recurring profiles reuse the document form (with a schedule card) for create / edit. */
const recurringRoutes = (path: string, type: 'invoice' | 'bill'): Routes => [
  { path, data: { recurringType: type }, loadComponent: () => import('./features/recurring/recurring-list').then((m) => m.RecurringList) },
  { path: `${path}/new`, data: { docType: type, recurring: true }, loadComponent: () => import('./features/documents/document-form').then((m) => m.DocumentForm) },
  { path: `${path}/:id/edit`, data: { docType: type, recurring: true }, loadComponent: () => import('./features/documents/document-form').then((m) => m.DocumentForm) },
];

const contactRoutes = (path: string, type: 'customer' | 'vendor'): Routes => [
  { path, data: { contactType: type }, loadComponent: () => import('./features/contacts/contact-list').then((m) => m.ContactList) },
  { path: `${path}/new`, data: { contactType: type }, loadComponent: () => import('./features/contacts/contact-form').then((m) => m.ContactForm) },
  { path: `${path}/:id`, data: { contactType: type }, loadComponent: () => import('./features/contacts/contact-view').then((m) => m.ContactView) },
  { path: `${path}/:id/edit`, data: { contactType: type }, loadComponent: () => import('./features/contacts/contact-form').then((m) => m.ContactForm) },
];

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · v-one',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'Create account · v-one',
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard · v-one', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      ...contactRoutes('customers', 'customer'),
      ...contactRoutes('vendors', 'vendor'),
      { path: 'items', loadComponent: () => import('./features/items/item-list').then((m) => m.ItemList) },
      { path: 'items/new', loadComponent: () => import('./features/items/item-form').then((m) => m.ItemForm) },
      { path: 'items/:id/edit', loadComponent: () => import('./features/items/item-form').then((m) => m.ItemForm) },
      ...docRoutes('sales/estimates', 'estimate'),
      ...docRoutes('sales/orders', 'sales_order'),
      ...docRoutes('sales/delivery-challans', 'delivery_challan'),
      ...docRoutes('sales/retainer-invoices', 'retainer_invoice'),
      ...recurringRoutes('sales/recurring-invoices', 'invoice'),
      { path: 'sales/reminders', title: 'Payment reminders · v-one', loadComponent: () => import('./features/reminders/reminder-list').then((m) => m.ReminderList) },
      ...docRoutes('sales/invoices', 'invoice'),
      ...docRoutes('sales/credit-notes', 'credit_note'),
      ...docRoutes('purchases/orders', 'purchase_order'),
      ...docRoutes('purchases/vendor-credits', 'vendor_credit'),
      ...recurringRoutes('purchases/recurring-bills', 'bill'),
      { path: 'purchases/scan-bill', title: 'Scan bill · v-one', loadComponent: () => import('./features/ai/bill-scan').then((m) => m.BillScan) },
      ...docRoutes('purchases/bills', 'bill'),
      { path: 'payments/received', data: { direction: 'in' }, loadComponent: () => import('./features/payments/payment-list').then((m) => m.PaymentList) },
      { path: 'payments/made', data: { direction: 'out' }, loadComponent: () => import('./features/payments/payment-list').then((m) => m.PaymentList) },
      { path: 'expenses', loadComponent: () => import('./features/expenses/expense-list').then((m) => m.ExpenseList) },
      { path: 'banking', title: 'Banking · v-one', loadComponent: () => import('./features/banking/banking-list').then((m) => m.BankingList) },
      { path: 'banking/:id', loadComponent: () => import('./features/banking/bank-account').then((m) => m.BankAccount) },
      { path: 'accounting/accounts', loadComponent: () => import('./features/accounting/account-list').then((m) => m.AccountList) },
      { path: 'accounting/journals', loadComponent: () => import('./features/accounting/journal-list').then((m) => m.JournalList) },
      { path: 'accounting/journals/new', loadComponent: () => import('./features/accounting/journal-form').then((m) => m.JournalForm) },
      { path: 'accounting/journals/:id/edit', loadComponent: () => import('./features/accounting/journal-form').then((m) => m.JournalForm) },
      { path: 'reports', title: 'Reports · v-one', loadComponent: () => import('./features/reports/report-hub').then((m) => m.ReportHub) },
      { path: 'reports/:report', loadComponent: () => import('./features/reports/report-view').then((m) => m.ReportView) },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings-shell').then((m) => m.SettingsShell),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'organization' },
          { path: 'organization', loadComponent: () => import('./features/settings/organization-settings').then((m) => m.OrganizationSettings) },
          { path: 'profile', loadComponent: () => import('./features/settings/profile-settings').then((m) => m.ProfileSettings) },
          { path: 'taxes', loadComponent: () => import('./features/settings/tax-settings').then((m) => m.TaxSettings) },
          { path: 'numbering', loadComponent: () => import('./features/settings/numbering-settings').then((m) => m.NumberingSettings) },
          { path: 'locking', loadComponent: () => import('./features/settings/lock-settings').then((m) => m.LockSettings) },
          { path: 'features', loadComponent: () => import('./features/settings/feature-settings').then((m) => m.FeatureSettings) },
          { path: 'pdf', loadComponent: () => import('./features/settings/pdf-settings').then((m) => m.PdfSettings) },
          { path: 'users', canActivate: [adminGuard], loadComponent: () => import('./features/settings/user-settings').then((m) => m.UserSettings) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
