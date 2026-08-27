import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { filter, firstValueFrom, last, tap } from 'rxjs';
import { TicketsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { TICKET_CATEGORY_LABELS } from '../../core/models';

interface TicketFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  progress: number;
}

const MAX_SIZE = 25 * 1024 * 1024;

@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-ticket.html',
})
export class NewTicket {
  private readonly ticketsService = inject(TicketsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  readonly saving = signal(false);
  readonly error = signal('');
  readonly files = signal<TicketFile[]>([]);

  readonly categories = Object.entries(TICKET_CATEGORY_LABELS);

  readonly form = this.fb.nonNullable.group({
    subject: ['', [Validators.required, Validators.maxLength(255)]],
    category: ['general'],
    priority: ['medium'],
    message: ['', [Validators.required]],
  });

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    input.value = '';
    for (const file of selected) {
      if (file.size > MAX_SIZE) {
        this.toast.error(`${file.name} exceeds the 25 MB limit.`);
        continue;
      }
      if (file.size < 1) {
        this.toast.error(`${file.name} is empty.`);
        continue;
      }
      this.files.update((list) => [
        ...list,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          status: 'pending',
          progress: 0,
        },
      ]);
    }
  }

  removeFile(id: string): void {
    this.files.update((list) => list.filter((f) => f.id !== id));
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.error.set('');
    this.saving.set(true);
    try {
      const f = this.form.getRawValue();
      const ticket = await this.ticketsService.create({
        subject: f.subject,
        category: f.category,
        priority: f.priority,
        message: f.message,
      });

      const messageId = ticket.messages?.[0]?.id;
      const pendingFiles = this.files().filter((x) => x.status === 'pending');
      let failed = 0;
      if (messageId && pendingFiles.length > 0) {
        for (const item of pendingFiles) {
          this.files.update((list) =>
            list.map((x) =>
              x.id === item.id ? { ...x, status: 'uploading' as const, progress: 0 } : x,
            ),
          );
          const ok = await this.uploadFile(messageId, item);
          this.files.update((list) =>
            list.map((x) =>
              x.id === item.id
                ? { ...x, status: ok ? 'success' as const : 'failed' as const, progress: ok ? 100 : 0 }
                : x,
            ),
          );
          if (!ok) failed++;
        }
      }

      this.toast.success('Ticket created');
      await this.router.navigate(['/support', ticket.id]);
    } catch (err) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ??
          'Failed to create ticket. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async uploadFile(messageId: string, item: TicketFile): Promise<boolean> {
    const contentType = item.file.type || 'application/octet-stream';
    try {
      const { upload_url } = await this.ticketsService.attachmentUploadUrl({
        message_id: messageId,
        filename: item.file.name,
        content_type: contentType,
        file_size_bytes: item.file.size,
      });
      await firstValueFrom(
        this.http
          .put(upload_url, item.file, {
            headers: { 'Content-Type': contentType },
            reportProgress: true,
            observe: 'events',
          })
          .pipe(
            filter((event) => event.type === HttpEventType.UploadProgress),
            tap((event) => {
              if (event.type === HttpEventType.UploadProgress && event.total) {
                const percent = Math.round((event.loaded / event.total) * 100);
                this.files.update((list) =>
                  list.map((x) =>
                    x.id === item.id ? { ...x, progress: percent } : x,
                  ),
                );
              }
            }),
            last(),
          ),
      );
      return true;
    } catch {
      return false;
    }
  }
}
