import { ChangeDetectionStrategy, Component, ElementRef, input, OnDestroy, OnInit, output, signal, viewChild } from '@angular/core';
import { Modal } from './modal';

/** The browser's built-in barcode reader (Chrome on Android, macOS and ChromeOS; Edge). */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

export function cameraScanSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix'];

/**
 * Scan a barcode or QR code with the camera, or with a USB / Bluetooth scanner (it types the code
 * and presses Enter into the box), or type it. Emits each code; stays open in continuous mode.
 */
@Component({
  selector: 'app-barcode-scanner',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="title()" [width]="480" (closed)="stop(); closed.emit()">
      @if (camera()) {
        <div class="viewport">
          <video #video playsinline muted></video>
          <div class="aim" aria-hidden="true"></div>
        </div>
        @if (status(); as s) { <p class="muted center">{{ s }}</p> }
      } @else {
        <div class="alert alert--info">
          {{ cameraMessage() }}
        </div>
      }
      <form class="manual" (submit)="$event.preventDefault(); submit(code.value); code.value = ''">
        <label class="sr-only" for="scan-code">Barcode</label>
        <input #code id="scan-code" class="input" autocomplete="off" placeholder="Scan with a USB scanner or type the code" autofocus />
        <button type="submit" class="btn btn--outline">Add</button>
      </form>
      @if (last(); as l) { <p class="muted center small">Last scan: <strong>{{ l }}</strong></p> }
      <ng-container modal-footer>
        <button type="button" class="btn" (click)="stop(); closed.emit()">Done</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .viewport { position: relative; border-radius: 10px; overflow: hidden; background: #000; aspect-ratio: 4 / 3; }
    video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .aim { position: absolute; inset: 22% 12%; border: 2px solid rgba(255, 255, 255, 0.85); border-radius: 10px; box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.25); }
    .manual { display: flex; gap: 8px; margin-top: 12px; }
    .center { text-align: center; margin: 8px 0 0; }
    .small { font-size: 12.5px; }
  `,
})
export class BarcodeScanner implements OnInit, OnDestroy {
  readonly title = input('Scan barcode');
  /** Keep scanning after a hit (adding several items to a bill). */
  readonly continuous = input(false);
  readonly scanned = output<string>();
  readonly closed = output<void>();

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  protected readonly camera = signal(cameraScanSupported());
  protected readonly cameraMessage = signal('Camera scanning needs Chrome or Edge on Android or a Mac. On this device use a USB or Bluetooth scanner, or type the code.');
  protected readonly status = signal('Starting camera…');
  protected readonly last = signal('');

  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private lastCode = '';
  private lastAt = 0;

  ngOnInit(): void {
    if (this.camera()) setTimeout(() => void this.start());
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      this.camera.set(false);
      this.cameraMessage.set('The camera could not be opened (permission refused or no camera). Use a USB scanner or type the code.');
      return;
    }
    if (this.stopped) return this.stop();
    const video = this.video()?.nativeElement;
    if (!video) return this.stop();
    video.srcObject = this.stream;
    await video.play().catch(() => undefined);
    this.status.set('Point the camera at the barcode or QR code.');
    const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = new Detector({ formats: FORMATS });
    const tick = async () => {
      if (this.stopped) return;
      try {
        const found = await detector.detect(video);
        if (found[0]?.rawValue) this.hit(found[0].rawValue);
      } catch {
        /* frame not ready */
      }
      if (!this.stopped) this.timer = setTimeout(tick, 180);
    };
    void tick();
  }

  private hit(code: string): void {
    // The same code stays in view for a while: count it once per 2 seconds.
    const now = Date.now();
    if (code === this.lastCode && now - this.lastAt < 2000) return;
    this.lastCode = code;
    this.lastAt = now;
    navigator.vibrate?.(60);
    this.submit(code);
  }

  protected submit(raw: string): void {
    const code = raw.trim();
    if (!code) return;
    this.last.set(code);
    this.scanned.emit(code);
    if (!this.continuous()) {
      this.stop();
      this.closed.emit();
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

/**
 * USB / Bluetooth scanners type the code very fast and press Enter. Outside text boxes, such a burst
 * is caught here so scanning works without clicking anything first. Returns a function that stops listening.
 */
export function listenForScanner(onCode: (code: string) => void): () => void {
  let buffer = '';
  let lastKey = 0;
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const now = performance.now();
    if (now - lastKey > 60) buffer = ''; // people type slower than ~60 ms per key; scanners don't
    lastKey = now;
    if (e.key === 'Enter') {
      if (buffer.length >= 4) {
        e.preventDefault();
        onCode(buffer);
      }
      buffer = '';
    } else if (e.key.length === 1) {
      buffer += e.key;
    }
  };
  document.addEventListener('keydown', onKey, true);
  return () => document.removeEventListener('keydown', onKey, true);
}
