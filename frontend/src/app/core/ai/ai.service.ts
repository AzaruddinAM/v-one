import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { ApiService } from '../api/api.service';
import { AiStatus, BillImportResult, BillPreview, ChatMessage, ChatReply } from './ai.models';

/** Gemini powered features — all calls go through the Laravel API, which holds the API key. */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly api = inject(ApiService);
  private status$?: Observable<AiStatus>;

  /** A file picked somewhere else (e.g. the chat 📎 button) waiting for the scan page. */
  readonly pendingFile = signal<File | null>(null);

  status(): Observable<AiStatus> {
    this.status$ ??= this.api.get<AiStatus>('ai/status').pipe(
      catchError(() => of({ enabled: false, model: '' })),
      shareReplay(1),
    );
    return this.status$;
  }

  scanBill(file: File): Observable<BillPreview> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.post<BillPreview>('ai/scan-bill', body);
  }

  importBill(payload: unknown): Observable<BillImportResult> {
    return this.api.post<BillImportResult>('ai/import-bill', payload);
  }

  chat(history: ChatMessage[]): Observable<ChatReply> {
    const messages = history.filter((m) => !m.error && !m.local).map(({ role, text }) => ({ role, text }));
    return this.api.post<ChatReply>('ai/chat', { messages });
  }
}
