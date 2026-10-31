import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { ChatMessage } from '../../core/ai/ai.models';
import { AiService } from '../../core/ai/ai.service';
import { CHAT_COMMANDS, ChatCommand, parseCommand, suggestCommands } from '../../core/ai/chat-commands';
import { renderMarkdown } from '../../core/ai/markdown';
import { AuthStore } from '../../core/auth/auth.store';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';

const QUICK = ['/summary', '/dues', '/overdue', '/scan', '/help'];
const MAX_KEEP = 60;

const helpText = () =>
  '**Commands** — type them, or just ask in your own words.\n\n' +
  CHAT_COMMANDS.map((c) => `- \`${c.usage}\` — ${c.description}${c.example ? ` (e.g. \`${c.example}\`)` : ''}`).join('\n') +
  '\n\nTip: press **📎** to scan a bill, **↑** to edit your last message, **Ctrl + /** to open or close this chat.';

/** Floating Gemini chat assistant, available on every page of the app. */
@Component({
  selector: 'app-chat-widget',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './chat-widget.scss',
  host: { '(document:keydown.control./)': 'toggle()' },
  template: `
    @if (open()) {
      <section class="chat" role="dialog" aria-label="v-one Assistant">
        <header class="chat__head">
          <span class="chat__logo"><app-icon name="sparkles" [size]="18" /></span>
          <div class="chat__title">
            <strong>v-one Assistant</strong>
            <small>{{ enabled() === false ? 'Not configured' : 'Powered by Gemini' }}</small>
          </div>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="run('/help')" title="Commands" aria-label="Show commands">?</button>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="clear()" title="New chat" aria-label="New chat"><app-icon name="refresh" [size]="16" /></button>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="open.set(false)" aria-label="Close chat"><app-icon name="x" [size]="16" /></button>
        </header>

        <div class="chat__body" #scroller (click)="onBodyClick($event)">
          @if (!messages().length) {
            <div class="welcome">
              <p>Hi {{ firstName() }} 👋 I can answer questions about your business, read bills, draft reminders and help with anything else.</p>
              <ul>
                <li>“How much did I sell this month?”</li>
                <li>“Which customers owe me more than ₹10,000?”</li>
                <li>“Write a WhatsApp reminder for Ravi Stores”</li>
                <li>“What is 18% GST on ₹4,250?”</li>
              </ul>
            </div>
          }
          @for (m of messages(); track m.at) {
            <div class="msg" [class.msg--user]="m.role === 'user'" [class.msg--error]="m.error">
              @if (m.role === 'user') {
                <div class="bubble">{{ m.display ?? m.text }}</div>
              } @else {
                <div class="bubble md" [innerHTML]="html(m.text)"></div>
                @if (!m.error && !m.local) {
                  <button type="button" class="copy" (click)="copy(m.text)" aria-label="Copy reply"><app-icon name="copy" [size]="13" /> Copy</button>
                }
              }
            </div>
          }
          @if (busy()) {
            <div class="msg"><div class="bubble typing"><span></span><span></span><span></span></div></div>
          }
        </div>

        <div class="chat__quick">
          @for (q of quick; track q) {
            <button type="button" class="chip-btn" (click)="run(q)" [disabled]="busy()">{{ q }}</button>
          }
        </div>

        <form class="chat__input" (submit)="$event.preventDefault(); send()">
          @if (suggestions().length) {
            <ul class="suggest" role="listbox">
              @for (c of suggestions(); track c.name; let i = $index) {
                <li role="option" [class.is-active]="i === active()" (mousedown)="$event.preventDefault(); useSuggestion(c)">
                  <code>{{ c.usage }}</code><small>{{ c.description }}</small>
                </li>
              }
            </ul>
          }
          <button type="button" class="btn btn--ghost btn--icon" (click)="fileInput.click()" title="Scan a bill" aria-label="Attach a bill to scan">
            <app-icon name="paperclip" />
          </button>
          <input #fileInput type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" (change)="onFile($event)" />
          <textarea
            #box
            rows="1"
            class="textarea"
            placeholder="Ask anything, or type / for commands"
            [value]="draft()"
            (input)="onType($any($event.target).value)"
            (keydown)="onKey($event)"
          ></textarea>
          <button type="submit" class="btn btn--icon" [disabled]="busy() || !draft().trim()" aria-label="Send"><app-icon name="send" [size]="16" /></button>
        </form>
      </section>
    }

    <button type="button" class="fab" [class.is-open]="open()" (click)="toggle()" [attr.aria-label]="open() ? 'Close assistant' : 'Open AI assistant'" title="AI assistant (Ctrl + /)">
      <app-icon [name]="open() ? 'x' : 'sparkles'" [size]="24" />
    </button>
  `,
})
export class ChatWidget {
  private readonly ai = inject(AiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly quick = QUICK;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly draft = signal('');
  protected readonly active = signal(0);
  protected readonly messages = signal<ChatMessage[]>(this.restore());
  protected readonly suggestions = computed(() => suggestCommands(this.draft()));
  protected readonly enabled = toSignal(this.ai.status().pipe(map((s) => s.enabled)), { initialValue: null });
  protected readonly firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0]);
  private readonly htmlCache = new Map<string, string>();
  private seq = Date.now();

  constructor() {
    effect(() => {
      const list = this.messages();
      try {
        sessionStorage.setItem(this.storageKey(), JSON.stringify(list.slice(-MAX_KEEP)));
      } catch {
        /* storage unavailable — chat still works for this page view */
      }
      this.scrollDown();
    });
    effect(() => {
      if (this.open()) setTimeout(() => this.box()?.nativeElement.focus());
    });
  }

  toggle(): void {
    this.open.update((o) => !o);
  }

  protected html(text: string): string {
    let h = this.htmlCache.get(text);
    if (h === undefined) {
      h = renderMarkdown(text);
      this.htmlCache.set(text, h);
    }
    return h;
  }

  protected onType(v: string): void {
    this.draft.set(v);
    this.active.set(0);
  }

  /** Programmatic changes also write the textarea directly — `[value]` skips the update when it never saw the typed text. */
  private setDraft(v: string): void {
    this.draft.set(v);
    const el = this.box()?.nativeElement;
    if (el) el.value = v;
  }

  protected onKey(e: KeyboardEvent): void {
    const s = this.suggestions();
    if (s.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      this.active.set((this.active() + (e.key === 'ArrowDown' ? 1 : s.length - 1)) % s.length);
      return;
    }
    if (s.length && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && s[this.active()].name !== this.draft().slice(1)))) {
      e.preventDefault();
      this.useSuggestion(s[this.active()]);
      return;
    }
    if (e.key === 'ArrowUp' && !this.draft()) {
      const last = [...this.messages()].reverse().find((m) => m.role === 'user');
      if (last) {
        e.preventDefault();
        this.setDraft(last.display ?? last.text);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  protected useSuggestion(c: ChatCommand): void {
    const needsArg = c.usage.includes('<') || c.usage.includes('[');
    if (needsArg) {
      this.setDraft(`/${c.name} `);
      this.box()?.nativeElement.focus();
    } else {
      this.run(`/${c.name}`);
    }
  }

  protected send(): void {
    const text = this.draft().trim();
    if (text && !this.busy()) this.run(text);
  }

  protected run(input: string): void {
    this.setDraft('');
    const cmd = parseCommand(input);
    switch (cmd.kind) {
      case 'help':
        this.push({ role: 'user', text: input, local: true }, { role: 'model', text: helpText(), local: true });
        return;
      case 'clear':
        this.clear();
        return;
      case 'scan':
        this.fileInput()?.nativeElement.click();
        return;
      case 'navigate':
        this.push({ role: 'user', text: input, local: true }, { role: 'model', text: `Opening **${cmd.label}**…`, local: true });
        void this.router.navigateByUrl(cmd.url);
        return;
      case 'error':
        this.push({ role: 'user', text: input, local: true }, { role: 'model', text: cmd.text, local: true });
        return;
      case 'prompt':
        if (!cmd.text) return;
        this.ask(cmd.text, input !== cmd.text ? input : undefined);
    }
  }

  private ask(text: string, display?: string): void {
    this.push({ role: 'user', text, display });
    this.busy.set(true);
    this.ai.chat(this.messages()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.push({ role: 'model', text: r.reply });
      },
      error: (e) => {
        this.busy.set(false);
        this.push({ role: 'model', text: '⚠️ ' + errorMessage(e, 'The assistant is unavailable right now.'), error: true });
      },
    });
  }

  protected clear(): void {
    this.messages.set([]);
    this.htmlCache.clear();
  }

  protected onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.ai.pendingFile.set(f);
    this.push({ role: 'user', text: `📎 ${f.name}`, local: true }, { role: 'model', text: 'Reading your bill… check the extracted data on the **Scan bill** page and press **Confirm & save**.', local: true });
    void this.router.navigateByUrl('/purchases/scan-bill');
  }

  protected copy(text: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.toast.success('Copied'),
      () => this.toast.error('Could not copy'),
    );
  }

  /** Route relative links in replies through the Angular router instead of reloading the page. */
  protected onBodyClick(e: MouseEvent): void {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (href?.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault();
      void this.router.navigateByUrl(href);
      if (window.innerWidth < 640) this.open.set(false);
    }
  }

  /** Messages flagged `local` or `error` stay in the browser and are never sent to Gemini. */
  private push(...msgs: Omit<ChatMessage, 'at'>[]): void {
    this.messages.update((list) => [...list, ...msgs.map((m) => ({ ...m, at: ++this.seq }))].slice(-MAX_KEEP));
  }

  private scrollDown(): void {
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private storageKey(): string {
    return `v-one.chat.${this.auth.user()?.id ?? 'guest'}`;
  }

  private restore(): ChatMessage[] {
    try {
      const raw = sessionStorage.getItem(this.storageKey());
      return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  }
}
