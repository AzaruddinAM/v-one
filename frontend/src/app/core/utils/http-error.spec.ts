import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage, fieldErrors } from './http-error';

describe('http error helpers', () => {
  const validation = new HttpErrorResponse({
    status: 422,
    error: { message: 'The given data was invalid.', errors: { phone: ['Invalid phone number or password.'], password: ['Too short'] } },
  });

  it('returns the first validation message', () => {
    expect(errorMessage(validation)).toBe('Invalid phone number or password.');
  });

  it('maps field errors', () => {
    expect(fieldErrors(validation)).toEqual({ phone: 'Invalid phone number or password.', password: 'Too short' });
  });

  it('handles network failures and unknown errors', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('Cannot reach the server');
    expect(errorMessage(new Error('x'), 'fallback')).toBe('fallback');
    expect(fieldErrors(new HttpErrorResponse({ status: 500 }))).toEqual({});
  });
});
