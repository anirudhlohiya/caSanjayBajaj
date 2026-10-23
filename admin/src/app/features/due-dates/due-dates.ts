import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DueDateInput, DueDatesAdminService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { DueDate } from '../../core/models';
import {
  AUDIENCE_LABELS,
  DUE_DATE_AUDIENCES,
  DUE_DATE_CATEGORIES,
  DUE_DATE_CATEGORY_KEYS,
} from '../../core/due-date-meta';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

interface MonthGroup {
  key: string;
  label: string;
  items: DueDate[];
}

/** "2026-27" for dates from 1 Apr 2026 to 31 Mar 2027. */
function currentFy(today = new Date()): string {
  const start = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_FORM = (fy: string): DueDateInput => ({
  title: '',
  form: '',
  category: 'gst',
  due_date: '',
  original_due_date: '',
  period_label: '',
  description: '',
  audiences: ['all'],
  fy,
  is_active: true,
});

@Component({
  selector: 'app-due-dates',
  standalone: true,
  imports: [FormsModule, PageHeader, Modal, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './due-dates.html',
})
export class DueDatesPage implements OnInit {
  private readonly api = inject(DueDatesAdminService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly rows = signal<DueDate[]>([]);
  readonly fy = signal(currentFy());
  readonly years = signal<string[]>([]);
  readonly category = signal<string>('all');
  readonly search = signal('');
  readonly showPast = signal(false);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<DueDateInput>(EMPTY_FORM(currentFy()));
  readonly extended = signal(false);

  readonly categories = DUE_DATE_CATEGORIES;
  readonly categoryKeys = DUE_DATE_CATEGORY_KEYS;
  readonly audiences = DUE_DATE_AUDIENCES;
  readonly audienceLabels = AUDIENCE_LABELS;
  readonly today = todayIso();

  readonly yearOptions = computed(() => {
    const set = new Set([...this.years(), currentFy(), nextFy(currentFy())]);
    return [...set].sort().reverse();
  });

  readonly counts = computed(() => {
    const all = this.rows();
    const out: Record<string, number> = { all: all.length };
    for (const k of DUE_DATE_CATEGORY_KEYS) out[k] = all.filter((r) => r.category === k).length;
    return out;
  });

  readonly stats = computed(() => {
    const all = this.rows();
    return {
      upcoming: all.filter((r) => r.is_active && r.due_date >= this.today).length,
      extended: all.filter((r) => r.original_due_date).length,
      hidden: all.filter((r) => !r.is_active).length,
    };
  });

  readonly groups = computed<MonthGroup[]>(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.category();
    const filtered = this.rows().filter((r) => {
      if (cat !== 'all' && r.category !== cat) return false;
      if (!this.showPast() && r.due_date < this.today) return false;
      if (!q) return true;
      return [r.title, r.form ?? '', r.period_label ?? '', r.description].some((t) => t.toLowerCase().includes(q));
    });
    const map = new Map<string, MonthGroup>();
    for (const r of filtered) {
      const key = r.due_date.slice(0, 7);
      if (!map.has(key)) {
        const d = new Date(`${key}-01T00:00:00`);
        map.set(key, { key, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), items: [] });
      }
      map.get(key)!.items.push(r);
    }
    return [...map.values()];
  });

  readonly pastCount = computed(() => this.rows().filter((r) => r.due_date < this.today).length);

  ngOnInit(): void {
    void this.loadYears();
    void this.load();
  }

  private async loadYears(): Promise<void> {
    try {
      this.years.set(await this.api.years());
    } catch {
      /* year picker falls back to current / next FY */
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.api.list(this.fy()));
    } finally {
      this.loading.set(false);
    }
  }

  setFy(fy: string): void {
    this.fy.set(fy);
    void this.load();
  }

  // --- Add / edit -----------------------------------------------------------

  openAdd(): void {
    this.form.set(EMPTY_FORM(this.fy()));
    this.extended.set(false);
    this.editingId.set(null);
    this.modalOpen.set(true);
  }

  openEdit(r: DueDate, extend = false): void {
    this.form.set({
      title: r.title,
      form: r.form ?? '',
      category: r.category,
      due_date: r.due_date,
      original_due_date: r.original_due_date ?? (extend ? r.due_date : ''),
      period_label: r.period_label ?? '',
      description: r.description,
      audiences: [...r.audiences],
      fy: r.fy,
      is_active: r.is_active,
    });
    this.extended.set(extend || !!r.original_due_date);
    this.editingId.set(r.id);
    this.modalOpen.set(true);
  }

  set<K extends keyof DueDateInput>(key: K, value: DueDateInput[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  toggleExtended(on: boolean): void {
    this.extended.set(on);
    if (on && !this.form().original_due_date) this.set('original_due_date', this.form().due_date);
  }

  toggleAudience(key: string, on: boolean): void {
    const current = this.form().audiences.filter((a) => a !== key);
    this.set('audiences', on ? [...current, key] : current);
  }

  readonly formValid = computed(() => {
    const f = this.form();
    return (
      f.title.trim().length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(f.due_date) &&
      f.audiences.length > 0 &&
      (!this.extended() || /^\d{4}-\d{2}-\d{2}$/.test(f.original_due_date))
    );
  });

  async save(): Promise<void> {
    if (!this.formValid() || this.saving()) return;
    this.saving.set(true);
    const body: DueDateInput = {
      ...this.form(),
      original_due_date: this.extended() ? this.form().original_due_date : '',
    };
    try {
      const id = this.editingId();
      if (id) {
        const updated = await this.api.update(id, body);
        this.rows.update((list) => sortByDate(list.map((r) => (r.id === id ? updated : r))));
        this.toast.success('Due date updated');
      } else {
        const created = await this.api.create(body);
        if (created.fy === this.fy()) this.rows.update((list) => sortByDate([...list, created]));
        this.toast.success('Due date added');
      }
      this.modalOpen.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(r: DueDate): Promise<void> {
    const updated = await this.api.update(r.id, { is_active: !r.is_active });
    this.rows.update((list) => list.map((x) => (x.id === r.id ? updated : x)));
  }

  async remove(): Promise<void> {
    const id = this.editingId();
    if (!id || !confirm('Delete this due date? Clients will no longer see it.')) return;
    await this.api.remove(id);
    this.rows.update((list) => list.filter((r) => r.id !== id));
    this.modalOpen.set(false);
    this.toast.success('Due date deleted');
  }

  // --- Display helpers ------------------------------------------------------

  day(iso: string): string {
    return iso.slice(8, 10);
  }

  weekday(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
  }

  fmt(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  daysLeft(iso: string): number {
    return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${this.today}T00:00:00`).getTime()) / 86400000);
  }
}

function nextFy(fy: string): string {
  const start = Number(fy.slice(0, 4)) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function sortByDate(list: DueDate[]): DueDate[] {
  return [...list].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title));
}
