import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginated } from './models';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Thin typed wrapper around HttpClient that prefixes the API base URL and drops empty params. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  private params(query?: QueryParams): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  get<T>(path: string, query?: QueryParams): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${path}`, { params: this.params(query) });
  }

  list<T>(path: string, query?: QueryParams): Observable<Paginated<T>> {
    return this.get<Paginated<T>>(path, query);
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${path}`, body);
  }

  delete<T = void>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${path}`);
  }
}
