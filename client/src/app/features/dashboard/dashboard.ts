import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

import { Spinner } from '../../shared/components/spinner';
import {
  DueDatesService,
  ReportsService,
  ServicesOfferedService,
} from '../../core/services/feature.services';
import { DueDate, Report, Service } from '../../core/models';
import {
  DUE_DATE_CATEGORIES,
  daysUntil,
  fyOf,
  nextDue,
  relevantAudiences,
} from '../../core/due-date-meta';

/** Local date as YYYY-MM-DD. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, Spinner, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly reportsService = inject(ReportsService);
  readonly router = inject(Router);

  readonly loading = signal(false);
  readonly latestReport = signal<Report | null>(null);

  /** First six visible services, in the order set in the admin panel. */
  readonly homeServices = signal<Service[]>([]);
  readonly servicesLoading = signal(true);
  private readonly servicesService = inject(ServicesOfferedService);
  private readonly dueDatesService = inject(DueDatesService);

  /** Deadlines for this financial year; the "Next due" card shows the nearest one for this client. */
  private readonly dueDates = signal<DueDate[]>([]);
  private readonly today = todayIso();
  readonly categories = DUE_DATE_CATEGORIES;
  readonly next = computed(() => {
    const p = this.auth.userProfile();
    return nextDue(this.dueDates(), this.today, relevantAudiences(p?.user_type, p?.gst_filing_frequency));
  });
  readonly nextDays = computed(() => {
    const n = this.next();
    return n ? daysUntil(n.due_date, this.today) : 0;
  });

  // Banner logic
  banners = [
    {
      titleTop: 'One Stop Solution for',
      titleHighlight: 'All Your ',
      titleEnd: 'Financial Needs',
      link: '/services',
      buttonText: 'Explore Services'
    },
    {
      titleTop: 'Track Your Returns',
      titleHighlight: 'Easily ',
      titleEnd: 'and Securely',
      link: '/reports',
      buttonText: 'View Dashboard'
    },
    {
      titleTop: 'Expert Advice',
      titleHighlight: 'Whenever ',
      titleEnd: 'You Need',
      link: '/support',
      buttonText: 'Get Support'
    }
  ];
  currentBannerIndex = signal(0);
  private bannerInterval: any;

  constructor() {
    this.loadGSTOverview();
  }

  ngOnInit() {
    this.bannerInterval = setInterval(() => {
      this.currentBannerIndex.update(i => (i + 1) % this.banners.length);
    }, 4000);
    void this.loadServices();
    void this.loadDueDates();
  }

  private async loadDueDates(): Promise<void> {
    try {
      this.dueDates.set(await this.dueDatesService.list(fyOf(new Date())));
    } catch {
      this.dueDates.set([]); // the card simply stays hidden
    }
  }

  /** "Due today", "1 day left", "4 days left". */
  daysLabel(days: number): string {
    if (days <= 0) return 'Due today';
    return days === 1 ? '1 day left' : `${days} days left`;
  }

  /** "Sat, 7 Nov" */
  shortDate(isoDate: string): string {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  private async loadServices(): Promise<void> {
    try {
      const services = await this.servicesService.listActive();
      this.homeServices.set(services.slice(0, 6));
    } catch {
      this.homeServices.set([]);
    } finally {
      this.servicesLoading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.bannerInterval) {
      clearInterval(this.bannerInterval);
    }
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