import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RentAgreementsService } from '../../core/services/feature.services';
import { Modal } from '../../shared/components/modal';
import { Spinner } from '../../shared/components/spinner';

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

@Component({
  selector: 'app-office-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spinner],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/60 backdrop-blur-xs">
        <div
          class="relative bg-surface rounded-xl shadow-2xl flex flex-col overflow-hidden border border-outline-variant transition-all duration-200"
          [class.w-full]="isMaximized()"
          [class.h-full]="isMaximized()"
          [class.rounded-none]="isMaximized()"
          [class.w-[96vw]]="!isMaximized()"
          [class.max-w-[1550px]]="!isMaximized()"
          [class.h-[94vh]]="!isMaximized()"
        >
          <!-- Header Bar -->
          <div class="px-5 py-3 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-secondary-container flex items-center justify-center text-secondary shrink-0">
                <span class="material-symbols-outlined" style="font-size: 22px">edit_document</span>
              </div>
              <div>
                <h2 class="text-base font-semibold text-on-surface flex items-center gap-2">
                  Word Document Editor
                  <span class="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">ONLYOFFICE</span>
                </h2>
                <p class="text-xs text-on-surface-variant hidden sm:block">Full desktop Word editor with live formatting, page margins, and auto-save</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                [title]="isMaximized() ? 'Restore size' : 'Maximize window'"
                (click)="toggleMaximize()"
              >
                <span class="material-symbols-outlined" style="font-size: 20px">
                  {{ isMaximized() ? 'fullscreen_exit' : 'fullscreen' }}
                </span>
              </button>
              <button
                type="button"
                class="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                title="Close editor"
                (click)="close()"
              >
                <span class="material-symbols-outlined" style="font-size: 20px">close</span>
              </button>
            </div>
          </div>

          <!-- Document Canvas Area -->
          <div class="relative flex-1 w-full min-h-0 bg-neutral-100 overflow-hidden">
            <div id="onlyoffice-doc-editor-container" class="w-full h-full" style="width: 100%; height: 100%;"></div>

            @if (loading()) {
              <div class="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-lowest/90 gap-2 z-10 pointer-events-none">
                <app-spinner />
                <span class="text-xs text-on-surface-variant font-medium">Loading OnlyOffice Document Editor...</span>
              </div>
            } @else if (loadError()) {
              <div class="absolute inset-0 flex flex-col items-center justify-center text-on-surface text-sm p-6 text-center gap-3 bg-surface-container-lowest z-20">
                <div class="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mb-1">
                  <span class="material-symbols-outlined" style="font-size: 28px">warning</span>
                </div>
                <h3 class="text-base font-semibold text-on-surface">Word Editor Unavailable</h3>
                <p class="text-xs text-error max-w-lg bg-error/5 p-3 rounded border border-error/20 font-mono text-left break-all">
                  {{ loadError() }}
                </p>
                <p class="text-xs text-on-surface-variant max-w-md">
                  No worries — you can seamlessly switch to the built-in browser editor to review and edit your agreement right now.
                </p>
                <div class="flex gap-2 mt-2">
                  <button type="button" class="btn-outline text-xs" (click)="close()">
                    Close
                  </button>
                  <button type="button" class="btn-primary text-xs flex items-center gap-1" (click)="onFallback()">
                    <span class="material-symbols-outlined" style="font-size: 16px">edit_note</span>
                    Switch to Built-in Browser Editor
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class OfficeEditor implements OnInit, OnDestroy {
  private readonly rentAgreementsService = inject(RentAgreementsService);

  readonly agreementId = input.required<string>();
  readonly closeEvent = output<void>();
  readonly fallbackToBrowser = output<void>();

  readonly open = signal(true);
  readonly loading = signal(true);
  readonly isMaximized = signal(false);
  readonly loadError = signal<string | null>(null);

  private docEditor?: any;
  private destroyed = false;

  ngOnInit(): void {
    void this.initEditor();
  }

  toggleMaximize(): void {
    this.isMaximized.update((v) => !v);
  }

  close(): void {
    this.destroyEditor();
    this.closeEvent.emit();
  }

  onFallback(): void {
    this.destroyEditor();
    this.fallbackToBrowser.emit();
    this.closeEvent.emit();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.destroyEditor();
  }

  private async initEditor(): Promise<void> {
    try {
      const res = await this.rentAgreementsService.getOfficeConfig(this.agreementId());
      const { serverUrl, config } = res.data;

      if (!serverUrl) {
        this.loadError.set('OnlyOffice server URL is not configured (check ONLYOFFICE_SERVER_URL in backend .env).');
        return;
      }

      await this.loadScript(`${serverUrl}/web-apps/apps/api/documents/api.js`);

      if (this.destroyed) return;

      const placeholderId = 'onlyoffice-doc-editor-container';
      const containerEl = document.getElementById(placeholderId);
      if (!containerEl) {
        this.loadError.set('Could not locate editor placeholder element in page.');
        return;
      }

      if (!window.DocsAPI?.DocEditor) {
        this.loadError.set(`DocsAPI script loaded from ${serverUrl} but DocsAPI.DocEditor constructor is missing.`);
        return;
      }

      // Hook OnlyOffice events
      config.events = {
        ...(config.events || {}),
        onAppReady: () => {
          this.loading.set(false);
        },
        onError: (event: any) => {
          console.error('OnlyOffice editor error event:', event);
          const errDetail = event?.data ? JSON.stringify(event.data) : 'Document could not be loaded';
          this.loadError.set(`OnlyOffice error: ${errDetail}`);
          this.loading.set(false);
        },
      };

      this.docEditor = new window.DocsAPI.DocEditor(placeholderId, config);

      // Auto-dismiss loading overlay after 4 seconds as fallback
      setTimeout(() => {
        if (!this.destroyed && this.loading()) {
          this.loading.set(false);
        }
      }, 4000);
    } catch (err: any) {
      console.error('OnlyOffice init error:', err);
      const msg = err?.error?.message || err?.message || 'Connection failed';
      if (typeof msg === 'string' && msg.includes('not enabled')) {
        this.loadError.set('OnlyOffice Word Editor is disabled in server config (ONLYOFFICE_ENABLED=false).');
      } else {
        this.loadError.set(`Unable to connect to OnlyOffice at https://office.snbajaj.com: ${msg}`);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}. Verify your Oracle server and SSL at office.snbajaj.com`));
      document.head.appendChild(script);
    });
  }

  private destroyEditor(): void {
    try {
      this.docEditor?.destroyEditor?.();
    } catch {
      /* ignore */
    }
    this.docEditor = undefined;
  }
}