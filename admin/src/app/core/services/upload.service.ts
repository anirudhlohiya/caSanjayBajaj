import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  upload(url: string, file: File, contentType: string) {
    return this.http.put(url, file, {
      headers: { 'Content-Type': contentType },
      reportProgress: true,
      observe: 'events',
    });
  }
}