import { ChangeDetectionStrategy, Component, inject, input, OnDestroy, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api/api.service';
import { Contact, DocumentLine, DocumentType } from '../core/api/models';
import { errorMessage } from '../core/utils/http-error';
import { Icon } from './icon';
import { Modal } from './modal';

export interface VoiceLine extends DocumentLine {
  has_image?: boolean;
  matched?: boolean;
}
export interface VoiceResult {
  transcript: string;
  contact: Pick<Contact, 'id' | 'name' | 'company_name' | 'email' | 'payment_terms'> | null;
  contact_name?: string | null;
  lines: VoiceLine[];
  ai: boolean;
}

export const VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)' },
  { code: 'ar-AE', label: 'العربية (Arabic)' },
] as const;

const LANG_KEY = 'v1.voice.lang';

/** Minimal typing for the Web Speech API (Chrome, Edge, Safari). */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as (new () => SpeechRecognitionLike) | null;
}

/**
 * Say what to add ("2 LED strips at 50 and one driver") in English, Malayalam or Arabic.
 * The words are shown (and can be corrected) before they are turned into lines.
 */
@Component({
  selector: 'app-voice-input',
  imports: [FormsModule, Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Add items by voice" [width]="520" (closed)="stop(); closed.emit()">
      <div class="top">
        <label class="sr-only" for="v-lang">Language</label>
        <select id="v-lang" class="select" [ngModel]="lang()" (ngModelChange)="setLang($event)" [disabled]="listening()">
          @for (l of languages; track l.code) { <option [value]="l.code">{{ l.label }}</option> }
        </select>
        @if (supported) {
          <button type="button" class="mic" [class.is-on]="listening()" (click)="listening() ? stop() : start()" [attr.aria-label]="listening() ? 'Stop listening' : 'Start listening'">
            <app-icon name="mic" [size]="26" />
          </button>
        }
      </div>
      <p class="muted hint">
        @if (!supported) {
          Speech isn't available in this browser (use Chrome, Edge or Safari). You can type instead.
        } @else if (listening()) {
          Listening… say items, quantities and prices. Tap the mic to stop.
        } @else {
          Tap the mic and say, for example: <em>"2 LED strips at 50 and one driver"</em> or <em>"for Ravi Stores, 3 fans"</em>.
        }
      </p>
      <label class="sr-only" for="v-text">What you said</label>
      <textarea id="v-text" class="textarea" rows="4" [dir]="lang().startsWith('ar') ? 'rtl' : 'auto'" [(ngModel)]="text" [placeholder]="listening() ? '…' : 'Your words appear here. You can correct them.'"></textarea>
      @if (interim()) { <p class="muted interim">{{ interim() }}</p> }
      <ng-container modal-footer>
        <button type="button" class="btn btn--outline" (click)="stop(); closed.emit()">Cancel</button>
        <button type="button" class="btn" (click)="submit()" [disabled]="busy() || !text.trim()">
          @if (busy()) { <span class="spinner"></span> Reading… } @else { Add to form }
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .top { display: flex; gap: 12px; align-items: center; justify-content: space-between; }
    .top .select { max-width: 240px; }
    .mic { width: 58px; height: 58px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center; color: #fff; background: var(--primary); flex-shrink: 0; }
    .mic.is-on { background: var(--danger); animation: pulse 1.2s ease-in-out infinite; }
    .mic:focus-visible { outline: 3px solid var(--primary-100); }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.45); } 50% { box-shadow: 0 0 0 12px rgba(220, 38, 38, 0); } }
    @media (prefers-reduced-motion: reduce) { .mic.is-on { animation: none; } }
    .hint { margin: 12px 0 8px; font-size: 13px; }
    .interim { margin: 6px 0 0; font-style: italic; }
  `,
})
export class VoiceInput implements OnDestroy {
  private readonly api = inject(ApiService);

  readonly docType = input.required<DocumentType>();
  readonly closed = output<void>();
  readonly parsed = output<VoiceResult>();
  readonly failed = output<string>();

  protected readonly languages = VOICE_LANGUAGES;
  protected readonly supported = !!recognitionCtor();
  protected readonly lang = signal(this.savedLang());
  protected readonly listening = signal(false);
  protected readonly interim = signal('');
  protected readonly busy = signal(false);
  protected text = '';
  private rec: SpeechRecognitionLike | null = null;

  private savedLang(): string {
    try {
      const v = localStorage.getItem(LANG_KEY);
      if (v && VOICE_LANGUAGES.some((l) => l.code === v)) return v;
    } catch {
      /* ignore */
    }
    return 'en-IN';
  }

  protected setLang(code: string): void {
    this.lang.set(code);
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch {
      /* ignore */
    }
  }

  start(): void {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = this.lang();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.text = (this.text ? this.text.trimEnd() + ', ' : '') + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      this.interim.set(interim);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.failed.emit('Microphone permission was refused. Allow it in the browser to use voice input.');
      else if (e.error === 'language-not-supported') this.failed.emit('This browser cannot recognise that language. Try Chrome, or type instead.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') this.failed.emit('Voice input stopped (' + e.error + ').');
    };
    rec.onend = () => {
      this.listening.set(false);
      this.interim.set('');
    };
    this.rec = rec;
    try {
      rec.start();
      this.listening.set(true);
    } catch {
      this.listening.set(false);
    }
  }

  stop(): void {
    this.rec?.stop();
    this.rec = null;
    this.listening.set(false);
  }

  ngOnDestroy(): void {
    this.rec?.abort();
  }

  submit(): void {
    const text = (this.text + (this.interim() ? ' ' + this.interim() : '')).trim();
    if (!text) return;
    this.stop();
    this.busy.set(true);
    this.api.post<VoiceResult>('ai/parse-lines', { text, type: this.docType() }).subscribe({
      next: (r) => {
        this.busy.set(false);
        if (!r.lines.length) {
          this.failed.emit('No items were recognised in that. Try "2 LED strips at 50".');
          return;
        }
        this.parsed.emit(r);
      },
      error: (e) => {
        this.busy.set(false);
        this.failed.emit(errorMessage(e));
      },
    });
  }
}
