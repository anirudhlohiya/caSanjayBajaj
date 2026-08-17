import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { filter, firstValueFrom, last, tap } from 'rxjs';
import { DocumentsService } from './feature.services';
import { UploadQueueService } from './upload-queue.service';

export type UploadOutcome = 'success' | 'queued' | 'failed';

export function isNetworkError(err: unknown): boolean {
  const e = err as { status?: number; name?: string };
  if (e.name === 'TimeoutError') return true;
  return e.status === 0 || e.status === undefined;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(
    private readonly http: HttpClient,
    private readonly documents: DocumentsService,
    private readonly queue: UploadQueueService,
  ) {}

  async uploadFile(
    file: File,
    periodId: string,
    onProgress?: (percent: number) => void,
  ): Promise<UploadOutcome> {
    const fileType = UploadService.guessFileType(file.name, file.type);
    const contentType = file.type || 'application/octet-stream';
    try {
      await this.performUpload(
        file,
        periodId,
        contentType,
        fileType,
        onProgress,
        0,
      );
      return 'success';
    } catch (err) {
      if (isNetworkError(err)) {
        await this.queue.enqueue({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          periodId,
          filename: file.name,
          contentType,
          fileType,
          sizeBytes: file.size,
          blob: file,
          queuedAt: Date.now(),
        });
        return 'queued';
      }
      return 'failed';
    }
  }

  private async performUpload(
    file: File,
    periodId: string,
    contentType: string,
    fileType: 'pdf' | 'image' | 'excel',
    onProgress: ((percent: number) => void) | undefined,
    attempt: number,
  ): Promise<void> {
    const { document_id, upload_url } = await this.documents.requestUploadUrl({
      filing_period_id: periodId,
      filename: file.name,
      contentType,
      file_type: fileType,
      file_size_bytes: file.size,
    });

    try {
      await firstValueFrom(
        this.http
          .put(upload_url, file, {
            headers: { 'Content-Type': contentType },
            reportProgress: true,
            observe: 'events',
          })
          .pipe(
            filter(
              (event) => event.type === HttpEventType.UploadProgress,
            ),
            tap((event) => {
              if (event.type === HttpEventType.UploadProgress && event.total) {
                onProgress?.(
                  Math.round((event.loaded / event.total) * 100),
                );
              }
            }),
            last(),
          ),
      );
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 403 && attempt === 0) {
        await this.performUpload(
          file,
          periodId,
          contentType,
          fileType,
          onProgress,
          1,
        );
        return;
      }
      throw err;
    }

    await this.documents.confirmUpload(document_id, file.size);
  }

  async processQueue(): Promise<{ sent: number; failed: number }> {
    const pending = await this.queue.list();
    let sent = 0;
    let failed = 0;
    for (const item of pending) {
      try {
        const file = new File([item.blob], item.filename, {
          type: item.contentType,
        });
        await this.performUpload(
          file,
          item.periodId,
          item.contentType,
          item.fileType,
          undefined,
          0,
        );
        await this.queue.remove(item.id);
        sent++;
      } catch (err) {
        if (isNetworkError(err)) {
          failed++;
          break;
        }
        await this.queue.remove(item.id);
        failed++;
      }
    }
    return { sent, failed };
  }

  static guessFileType(
    filename: string,
    contentType: string,
  ): 'pdf' | 'image' | 'excel' {
    const lower = filename.toLowerCase();
    if (contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/.test(lower)) {
      return 'image';
    }
    if (
      contentType.includes('spreadsheet') ||
      /\.(xlsx|xls|csv)$/.test(lower)
    ) {
      return 'excel';
    }
    return 'pdf';
  }
}
