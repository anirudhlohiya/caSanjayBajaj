import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  upload(url: string, file: File, contentType: string): Promise<void> {
    return lastValueFrom(
      this.http.put(url, file, {
        headers: { 'Content-Type': contentType },
        reportProgress: true,
      }),
    ).then(() => undefined);
  }
}
