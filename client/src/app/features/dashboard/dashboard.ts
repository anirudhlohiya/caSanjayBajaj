import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

import { Spinner } from '../../shared/components/spinner';
import { ReportsService } from '../../core/services/feature.services';
import { Report } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, Spinner, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard {
  readonly auth = inject(AuthService);
  private readonly reportsService = inject(ReportsService);
  readonly router = inject(Router);

  readonly loading = signal(false);
  readonly latestReport = signal<Report | null>(null);

  constructor() {
    this.loadGSTOverview();
  }

  async loadGSTOverview() {
    if (this.auth.userProfile()?.user_type === 'gst') {
      try {
        const res = await this.reportsService.list({ page: 1, pageSize: 1 });
        if (res.items.length > 0) {
          this.latestReport.set(res.items[0]);
        }
      } catch (e) {
        // Ignore or handle error
      }
    }
  }

  firstName(): string {
    const name = this.auth.userProfile()?.name;
    return name?.split(' ')[0] ?? 'there';
  }
}