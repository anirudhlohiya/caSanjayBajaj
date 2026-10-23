import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { DueDatesService } from '../../core/services/feature.services';
import { DueDate } from '../../core/models';
import {
  DUE_DATE_CATEGORIES,
  DUE_DATE_CATEGORY_KEYS,
  relevantAudiences,
} from '../../core/due-date-meta';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  categories: string[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parse(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

/** "2026-27" for dates from 1 Apr 2026 to 31 Mar 2027. */
function fyOf(d: Date): string {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

@Component({
  selector: 'app-due-dates',
  standalone: true,
  imports: [Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './due-dates.html',
})
export class DueDates {
  private readonly api = inject(DueDatesService);
  private readonly auth = inject(AuthService);

  readonly today = iso(new Date());
  readonly fy = fyOf(new Date());
  readonly weekdays = WEEKDAYS;
  readonly categories = DUE_DATE_CATEGORIES;
  readonly categoryKeys = DUE_DATE_CATEGORY_KEYS;

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly rows = signal<DueDate[]>([]);

  /** First day of the month shown in the grid. */
  readonly month = signal(this.startMonth());
  readonly selectedDay = signal<string | null>(null);
  readonly category = signal<string>('all');
  readonly expandedId = signal<string | null>(null);
  /** Direction of the last month change, for the slide-in animation. */
  readonly slide = signal<'next' | 'prev' | null>(null);
  readonly monthKey = computed(() => iso(this.month()).slice(0, 7));
  private touchStart: { x: number; y: number } | null = null;

  private readonly audiences = computed(() => {
    const p = this.auth.userProfile();
    return relevantAudiences(p?.user_type, p?.gst_filing_frequency);
  });
  /** "For you" is available only when the profile says what the client files. */
  readonly canPersonalise = computed(() => this.audiences() !== null);
  readonly personalised = signal(true);

  /** Rows after the "For you" and category filters. */
  readonly visible = computed(() => {
    const aud = this.personalised() ? this.audiences() : null;
    const cat = this.category();
    return this.rows().filter(
      (r) =>
        (cat === 'all' || r.category === cat) &&
        (!aud || r.audiences.some((a) => aud.has(a))),
    );
  });

  /** The next few deadlines from today. */
  readonly upcoming = computed(() =>
    this.visible()
      .filter((r) => r.due_date >= this.today)
      .slice(0, 3),
  );

  readonly monthLabel = computed(() =>
    this.month().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  );

  readonly canPrev = computed(() => this.month() > this.fyStart());
  readonly canNext = computed(() => this.month() < this.fyEnd());

  readonly grid = computed<CalendarDay[]>(() => {
    const first = this.month();
    const byDay = new Map<string, Set<string>>();
    for (const r of this.visible()) {
      if (!byDay.has(r.due_date)) byDay.set(r.due_date, new Set());
      byDay.get(r.due_date)!.add(r.category);
    }
    // Weeks start on Monday
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    const days: CalendarDay[] = [];
    const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const cells = Math.ceil((offset + lastOfMonth.getDate()) / 7) * 7;
    for (let i = 0; i < cells; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = iso(d);
      days.push({
        iso: key,
        day: d.getDate(),
        inMonth: d.getMonth() === first.getMonth(),
        isToday: key === this.today,
        categories: [...(byDay.get(key) ?? [])],
      });
    }
    return days;
  });

  /** Items listed under the grid: the selected day, or the whole month. */
  readonly listed = computed(() => {
    const day = this.selectedDay();
    if (day) return this.visible().filter((r) => r.due_date === day);
    const prefix = iso(this.month()).slice(0, 7);
    return this.visible().filter((r) => r.due_date.startsWith(prefix));
  });

  readonly selectedLabel = computed(() => {
    const day = this.selectedDay();
    return day
      ? parse(day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
      : null;
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.rows.set(await this.api.list(this.fy));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  shiftMonth(delta: number): void {
    if (delta < 0 ? !this.canPrev() : !this.canNext()) return;
    this.slide.set(delta > 0 ? 'next' : 'prev');
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
    this.selectedDay.set(null);
  }

  // Swipe left / right on the month grid to change month
  onTouchStart(e: TouchEvent): void {
    const t = e.touches[0];
    this.touchStart = { x: t.clientX, y: t.clientY };
  }

  onTouchEnd(e: TouchEvent): void {
    const start = this.touchStart;
    this.touchStart = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      this.shiftMonth(dx < 0 ? 1 : -1);
    }
  }

  selectDay(day: CalendarDay): void {
    if (!day.inMonth) {
      this.month.set(new Date(parse(day.iso).getFullYear(), parse(day.iso).getMonth(), 1));
    }
    this.selectedDay.set(this.selectedDay() === day.iso ? null : day.iso);
  }

  /** Jump the grid to a deadline (from the "Coming up" cards). */
  jumpTo(r: DueDate): void {
    const d = parse(r.due_date);
    this.month.set(new Date(d.getFullYear(), d.getMonth(), 1));
    this.selectedDay.set(r.due_date);
    this.expandedId.set(r.id);
  }

  toggle(r: DueDate): void {
    this.expandedId.set(this.expandedId() === r.id ? null : r.id);
  }

  daysLeft(isoDate: string): number {
    return Math.round((parse(isoDate).getTime() - parse(this.today).getTime()) / 86400000);
  }

  dueLabel(isoDate: string): string {
    const n = this.daysLeft(isoDate);
    if (n < 0) return 'Passed';
    if (n === 0) return 'Due today';
    if (n === 1) return 'Tomorrow';
    return `${n} days left`;
  }

  fmt(isoDate: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
    return parse(isoDate).toLocaleDateString('en-IN', opts);
  }

  weekday(isoDate: string): string {
    return parse(isoDate).toLocaleDateString('en-IN', { weekday: 'short' });
  }

  private fyStart(): Date {
    return new Date(Number(this.fy.slice(0, 4)), 3, 1);
  }

  private fyEnd(): Date {
    return new Date(Number(this.fy.slice(0, 4)) + 1, 2, 1);
  }

  private startMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
