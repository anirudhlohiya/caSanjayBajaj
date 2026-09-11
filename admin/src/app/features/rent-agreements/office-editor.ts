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
  imports: [Modal, Spinner],
  template: `
    <app-modal [open]="open()" (close)="close()">
      <div class="p-4">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-xl font-title-lg text-on-surface">Word Editor</h2>
          <button class="text-on-surface-variant hover:text-on-surface transition-colors" (click)="close()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <p class="text-xs text-on-surface-variant mb-3">
          Edit the agreement in a Word-like editor. Changes are saved back when you click Save in the editor.
        </p>
        <div class="relative w-full h-[70vh] rounded border border-outline-variant overflow-hidden">
        <div #editorHost class="w-full h-full"></div>
        @if (loading()) {
          <div class="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/80">
            <app-spinner />
          </div>
        } @else if (loadError()) {
          <div class="absolute inset-0 flex items-center justify-center text-error text-sm px-6 text-center">
            {{ loadError() }}
          </div>
        }
      </div>
      </div>
    </app-modal>
  `,
})
export class OfficeEditor implements OnInit, OnDestroy {
  private readonly rentAgreementsService = inject(RentAgreementsService);

  readonly agreementId = input.required<string>();
  readonly closeEvent = output<void>();

  readonly open = signal(true);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  @ViewChild('editorHost') editorHost?: ElementRef<HTMLDivElement>;

  private docEditor?: any;
  private destroyed = false;

  ngOnInit(): void {
    void this.initEditor();
  }

  close(): void {
    this.destroyEditor();
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
        this.loadError.set('OnlyOffice is not configured on the server.');
        return;
      }

      await this.loadScript(`${serverUrl}/web-apps/apps/api/documents/api.js`);

      if (this.destroyed) return;

      const host = this.editorHost?.nativeElement;
      if (!host || !window.DocsAPI) {
        this.loadError.set('Failed to load OnlyOffice editor.');
        return;
      }

      this.docEditor = new window.DocsAPI.DocEditor(host, config);
      this.loading.set(false);
    } catch (err) {
      console.error(err);
      this.loadError.set('Failed to open the Word editor. Check the OnlyOffice server configuration.');
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
      script.onerror = () => reject(new Error('OnlyOffice API script failed to load'));
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