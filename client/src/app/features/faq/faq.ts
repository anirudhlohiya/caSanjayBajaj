import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { marked } from 'marked';
import { ApiClient } from '../../core/services/api-client.service';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

interface Faq {
  id: string;
  category: string;
  question: string;
  answer_md: string;
}

/** Keys match backend FAQ_CATEGORIES; order is the page order. */
const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'gst', label: 'GST' },
  { key: 'itr', label: 'Income Tax' },
  { key: 'documents', label: 'Documents' },
  { key: 'app', label: 'Using the app' },
  { key: 'general', label: 'General' },
];

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterLink, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './faq.html',
})
export class FaqPage {
  private readonly api = inject(ApiClient);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly faqs = signal<Faq[]>([]);
  readonly search = signal('');
  readonly category = signal('all');
  readonly openId = signal<string | null>(null);

  /** Only topics that have questions, in page order. */
  readonly categories = computed(() =>
    CATEGORIES.filter((c) => this.faqs().some((f) => f.category === c.key)),
  );

  readonly groups = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.category();
    const list = this.faqs().filter(
      (f) =>
        (cat === 'all' || f.category === cat) &&
        (!q || f.question.toLowerCase().includes(q) || f.answer_md.toLowerCase().includes(q)),
    );
    return this.categories()
      .map((c) => ({ ...c, items: list.filter((f) => f.category === c.key) }))
      .filter((g) => g.items.length);
  });

  /** Rendered answers, cached per question. */
  private readonly html = computed(
    () =>
      new Map(
        this.faqs().map((f) => [f.id, marked.parse(f.answer_md, { async: false, gfm: true })]),
      ),
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.faqs.set(await firstValueFrom(this.api.get<Faq[]>('/faqs')));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  answer(f: Faq): string {
    return this.html().get(f.id) ?? '';
  }

  toggle(f: Faq): void {
    this.openId.set(this.openId() === f.id ? null : f.id);
  }
}
