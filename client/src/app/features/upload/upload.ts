import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { PeriodsService } from '../../core/services/feature.services';
import { UploadService } from '../../core/services/upload.service';
import { UploadQueueService, QueuedUpload } from '../../core/services/upload-queue.service';
import { GstFilingPeriod } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'queued';
  progress: number;
}

const MAX_SIZE = 50 * 1024 * 1024;

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [PageHeader, FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './upload.html',
})
export class Upload {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly periodsService = inject(PeriodsService);
  private readonly upload = inject(UploadService);
  private readonly queue = inject(UploadQueueService);

  readonly periods = signal<GstFilingPeriod[]>([]);
  readonly selectedPeriodId = signal<string>('');
  readonly items = signal<UploadItem[]>([]);
  readonly queuedCount = signal(0);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly uploadingCount = signal(0);

  readonly selectedPeriod = computed(() =>
    this.periods().find((p) => p.id === this.selectedPeriodId()),
  );
  readonly canUpload = computed(
    () =>
      this.items().length > 0 &&
      this.items().some((i) => i.status === 'pending' || i.status === 'failed') &&
      !this.busy(),
  );
  readonly allDone = computed(
    () =>
      this.items().length > 0 &&
      this.items().every((i) => i.status === 'success' || i.status === 'queued'),
  );
  readonly pendingUploadCount = computed(
    () =>
      this.items().filter(
        (i) => i.status === 'pending' || i.status === 'failed',
      ).length,
  );

  constructor() {
    void this.init();
  }

  async init(): Promise<void> {
    try {
      const periods = await this.periodsService.open();
      this.periods.set(periods);
      if (periods.length > 0) {
        this.selectedPeriodId.set(periods[0].id);
      }
      this.queuedCount.set((await this.queue.list()).length);
    } catch {
      this.error.set('Could not load filing periods. Check your connection.');
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const file of files) {
      this.addFile(file);
    }
  }

  addFile(file: File): void {
    const lower = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/.test(lower);
    const isExcel = file.type.includes('spreadsheet') || /\.(xlsx|xls|csv)$/.test(lower);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/.test(lower);
    if (!isPdf && !isImage && !isExcel) {
      this.toast.error(`${file.name} is not a PDF, image, or Excel file.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      this.toast.error(`${file.name} exceeds the 50 MB limit.`);
      return;
    }
    if (file.size < 1) {
      this.toast.error(`${file.name} is empty.`);
      return;
    }
    this.items.update((list) => [
      ...list,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        status: 'pending',
        progress: 0,
      },
    ]);
  }

  removeItem(id: string): void {
    this.items.update((list) => list.filter((i) => i.id !== id));
  }

  async uploadAll(): Promise<void> {
    if (!this.canUpload() || !this.selectedPeriodId()) {
      this.toast.error('Select a filing period and add files first.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const periodId = this.selectedPeriodId();

    for (const item of this.items()) {
      if (item.status === 'pending' || item.status === 'failed') {
        this.setStatus(item.id, 'uploading', 0);
        const outcome = await this.upload.uploadFile(
          item.file,
          periodId,
          (percent) => this.setProgress(item.id, percent),
        );
        if (outcome === 'success') {
          this.setStatus(item.id, 'success', 100);
        } else if (outcome === 'queued') {
          this.setStatus(item.id, 'queued', 0);
          this.queuedCount.set(this.queuedCount() + 1);
        } else {
          this.setStatus(item.id, 'failed', 0);
        }
      }
    }

    this.busy.set(false);
    const succeeded = this.items().filter((i) => i.status === 'success').length;
    if (succeeded > 0) {
      this.toast.success(`${succeeded} document${succeeded === 1 ? '' : 's'} uploaded.`);
    }
  }

  async resumeQueued(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const result = await this.upload.processQueue();
      if (result.sent > 0) {
        this.toast.success(`${result.sent} queued upload${result.sent === 1 ? '' : 's'} completed.`);
      }
    } finally {
      this.queuedCount.set((await this.queue.list()).length);
      this.busy.set(false);
    }
  }

  async removeQueued(item: QueuedUpload): Promise<void> {
    await this.queue.remove(item.id);
    this.queuedCount.set((await this.queue.list()).length);
  }

  goToDocuments(): void {
    void this.router.navigate(['/documents']);
  }

  setStatus(id: string, status: UploadItem['status'], progress: number): void {
    this.items.update((list) =>
      list.map((i) => (i.id === id ? { ...i, status, progress } : i)),
    );
  }

  setProgress(id: string, percent: number): void {
    this.items.update((list) =>
      list.map((i) => (i.id === id ? { ...i, progress: percent } : i)),
    );
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  dropZoneClick(): void {
    (document.getElementById('file-input') as HTMLInputElement | null)?.click();
  }
}