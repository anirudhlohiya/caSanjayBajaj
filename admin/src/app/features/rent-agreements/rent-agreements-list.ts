import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { RentAgreementsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { PageHeader } from '../../shared/components/page-header';
import { Pagination } from '../../shared/components/pagination';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';
import { DatePipe } from '@angular/common';
import { OfficeEditor } from './office-editor';

@Component({
  selector: 'app-rent-agreements-list',
  standalone: true,
  imports: [PageHeader, Pagination, StatusChip, Spinner, EmptyState, DatePipe, OfficeEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rent-agreements-list.html',
})
export class RentAgreementsList implements OnInit {
  private readonly rentAgreementsService = inject(RentAgreementsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly agreements = signal<any[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly officeOpenId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly summary = signal<{ total: number; draft: number; generated: number }>({
    total: 0,
    draft: 0,
    generated: 0,
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.rentAgreementsService.list({
        page: this.page(),
        limit: this.pageSize(),
      });
      // The backend returns { items, total, page, limit, totalPages }
      this.agreements.set(res.items || []);
      this.total.set(res.total || 0);
      this.totalPages.set(res.totalPages || 0);

      if (res.items && res.items.length === 0 && this.page() > 1) {
        this.page.set(this.page() - 1);
        void this.load();
        return;
      }
    } catch (err) {
      this.toast.error('Failed to load agreements');
      console.error(err);
    } finally {
      this.loading.set(false);
    }

    try {
      const s = await this.rentAgreementsService.summary();
      this.summary.set(s);
    } catch (err) {
      console.error(err);
    }
  }

  async deleteAgreement(id: string): Promise<void> {
    if (!window.confirm('Delete this rent agreement?\n\nIt will be hidden from the list. The record is kept for audit and can be reviewed later.')) {
      return;
    }
    this.deletingId.set(id);
    try {
      await this.rentAgreementsService.remove(id);
      this.toast.success('Agreement deleted');
      await this.load();
    } catch (err) {
      console.error(err);
      this.toast.error('Failed to delete agreement');
    } finally {
      this.deletingId.set(null);
    }
  }

  pageChanged(p: number): void {
    this.page.set(p);
    void this.load();
  }

  openOffice(id: string): void {
    this.officeOpenId.set(id);
  }

  createAgreement(): void {
    void this.router.navigate(['/rent-agreements/create']);
  }

  editAgreement(id: string): void {
    // Navigate to create/edit form, passing the ID
    void this.router.navigate(['/rent-agreements/create'], { queryParams: { id } });
  }

  downloadDocx(id: string): void {
    const url = this.rentAgreementsService.getDownloadUrl(id);
    
    // We append the auth token to the download url as query param, or just fetch via HTTP and save Blob
    // For standard NestJS with bearer token, often we just use window.open if cookies are used.
    // If headers are required, we do a blob download.
    const token = this.auth.access;
    if (token) {
        // Fetch as blob
        fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Download failed');
            return response.blob();
        })
        .then(blob => {
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = `Rent_Agreement_${id.substring(0, 8)}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            this.toast.success('Downloaded successfully');
        })
        .catch(err => {
            console.error(err);
            this.toast.error('Failed to download document');
        });
    }
  }
}
