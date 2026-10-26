import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import { FaqsAdminService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Faq } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

/** Keys match backend FAQ_CATEGORIES. */
export const FAQ_CATEGORIES: Array<{ key: string; label: string; icon: string }> = [
  { key: 'gst', label: 'GST', icon: 'receipt_long' },
  { key: 'itr', label: 'Income Tax', icon: 'account_balance_wallet' },
  { key: 'documents', label: 'Documents', icon: 'description' },
  { key: 'app', label: 'Using the app', icon: 'smartphone' },
  { key: 'general', label: 'General', icon: 'help' },
];

interface FaqForm {
  category: string;
  question: string;
  answer_md: string;
  is_active: boolean;
}

@Component({
  selector: 'app-faqs',
  standalone: true,
  imports: [FormsModule, PageHeader, Modal, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './faqs.html',
})
export class FaqsPage implements OnInit {
  private readonly api = inject(FaqsAdminService);
  private readonly toast = inject(ToastService);

  readonly categories = FAQ_CATEGORIES;
  readonly loading = signal(true);
  readonly faqs = signal<Faq[]>([]);
  readonly search = signal('');

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<FaqForm>({ category: 'general', question: '', answer_md: '', is_active: true });
  readonly preview = signal(false);

  readonly previewHtml = computed(() => marked.parse(this.form().answer_md || '', { async: false, gfm: true }));
  readonly canSave = computed(() => this.form().question.trim().length > 0 && this.form().answer_md.trim().length > 0);

  /** FAQs grouped by category, in display order; search filters across all. */
  readonly groups = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.faqs().filter(
      (f) => !q || f.question.toLowerCase().includes(q) || f.answer_md.toLowerCase().includes(q),
    );
    return FAQ_CATEGORIES.map((c) => ({ ...c, items: list.filter((f) => f.category === c.key) })).filter(
      (g) => g.items.length,
    );
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.faqs.set(await this.api.list());
    } finally {
      this.loading.set(false);
    }
  }

  openAdd(category = 'general'): void {
    this.editingId.set(null);
    this.form.set({ category, question: '', answer_md: '', is_active: true });
    this.preview.set(false);
    this.modalOpen.set(true);
  }

  openEdit(f: Faq): void {
    this.editingId.set(f.id);
    this.form.set({ category: f.category, question: f.question, answer_md: f.answer_md, is_active: f.is_active });
    this.preview.set(false);
    this.modalOpen.set(true);
  }

  set<K extends keyof FaqForm>(key: K, value: FaqForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) {
        const updated = await this.api.update(id, this.form());
        this.faqs.update((list) => list.map((f) => (f.id === id ? updated : f)));
        this.toast.success('FAQ updated');
      } else {
        const created = await this.api.create(this.form());
        this.faqs.update((list) => [...list, created]);
        this.toast.success('FAQ added');
      }
      this.modalOpen.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(f: Faq, event: Event): Promise<void> {
    event.stopPropagation();
    const updated = await this.api.update(f.id, { is_active: !f.is_active });
    this.faqs.update((list) => list.map((x) => (x.id === f.id ? updated : x)));
  }

  /** Move a question up / down within its category. */
  async move(f: Faq, delta: -1 | 1, event: Event): Promise<void> {
    event.stopPropagation();
    const list = [...this.faqs()];
    const same = list.filter((x) => x.category === f.category);
    const i = same.findIndex((x) => x.id === f.id);
    const other = same[i + delta];
    if (!other) return;
    const a = list.findIndex((x) => x.id === f.id);
    const b = list.findIndex((x) => x.id === other.id);
    [list[a], list[b]] = [list[b], list[a]];
    this.faqs.set(list);
    try {
      this.faqs.set(await this.api.reorder(list.map((x) => x.id)));
    } catch {
      await this.load();
    }
  }

  /** One-line preview: markdown markers stripped. */
  plain(md: string): string {
    return md
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>#]+/g, '')
      .replace(/^\s*(?:[-+]|\d+\.)\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async remove(): Promise<void> {
    const id = this.editingId();
    if (!id || !confirm('Delete this FAQ?')) return;
    await this.api.remove(id);
    this.faqs.update((list) => list.filter((f) => f.id !== id));
    this.modalOpen.set(false);
    this.toast.success('FAQ deleted');
  }
}
