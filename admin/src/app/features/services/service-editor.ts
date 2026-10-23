import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { marked } from 'marked';
import { ServiceInput, ServicesOfferedService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Service } from '../../core/models';
import {
  SERVICE_COLOR_KEYS,
  SERVICE_COLORS,
  SERVICE_ICONS,
  serviceTileClass,
} from '../../core/service-palette';
import { Spinner } from '../../shared/components/spinner';

type EditorView = 'write' | 'split' | 'preview';

const EMPTY: ServiceInput = {
  title: '',
  slug: '',
  description: '',
  tags: [],
  body_md: '',
  price: '',
  icon: 'home_repair_service',
  icon_color: 'blue',
  contact_phone: '',
  is_active: true,
};

const BODY_TEMPLATE = `## What we do

Describe the service in a few lines.

### Included
- First item
- Second item

## Documents we need
1. Document one
2. Document two

## FAQs
**How long does it take?**
Usually 3–5 working days.
`;

@Component({
  selector: 'app-service-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-editor.html',
})
export class ServiceEditorPage implements OnInit {
  private readonly servicesService = inject(ServicesOfferedService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Route param; 'new' when creating. */
  readonly id = input<string>('new');

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly draft = signal<ServiceInput>({ ...EMPTY });
  private readonly saved = signal<ServiceInput>({ ...EMPTY });
  readonly existing = signal<Service | null>(null);

  readonly view = signal<EditorView>('split');
  readonly tagInput = signal('');
  readonly iconSearch = signal('');
  readonly showIconPicker = signal(false);
  readonly showAdvanced = signal(false);

  private readonly bodyArea = viewChild<ElementRef<HTMLTextAreaElement>>('bodyArea');

  readonly isNew = computed(() => this.id() === 'new');
  readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()));
  readonly canSave = computed(
    () => this.draft().title.trim().length > 0 && this.draft().description.trim().length > 0,
  );
  readonly previewHtml = computed(() => marked.parse(this.draft().body_md || '', { async: false, gfm: true }));
  readonly wordCount = computed(() => {
    const text = this.draft().body_md.trim();
    return text ? text.split(/\s+/).length : 0;
  });

  readonly numbered = (i: number): string => `${i + 1}. `;
  readonly colorKeys = SERVICE_COLOR_KEYS;
  readonly colors = SERVICE_COLORS;
  readonly tileClass = serviceTileClass;
  readonly icons = computed(() => {
    const q = this.iconSearch().trim().toLowerCase().replace(/\s+/g, '_');
    return q ? SERVICE_ICONS.filter((i) => i.includes(q)) : SERVICE_ICONS;
  });

  async ngOnInit(): Promise<void> {
    if (this.isNew()) {
      const fresh = { ...EMPTY, body_md: BODY_TEMPLATE };
      this.draft.set(fresh);
      this.saved.set({ ...EMPTY });
      this.loading.set(false);
      return;
    }
    try {
      const s = await this.servicesService.get(this.id());
      this.existing.set(s);
      const value = toInput(s);
      this.draft.set(value);
      this.saved.set({ ...value, tags: [...value.tags] });
    } catch {
      void this.router.navigate(['/services']);
    } finally {
      this.loading.set(false);
    }
  }

  set<K extends keyof ServiceInput>(key: K, value: ServiceInput[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  // --- Tags -----------------------------------------------------------------

  addTag(): void {
    const parts = this.tagInput()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const existing = new Set(this.draft().tags.map((t) => t.toLowerCase()));
    const next = [...this.draft().tags];
    for (const p of parts) {
      if (!existing.has(p.toLowerCase()) && next.length < 10) {
        next.push(p.slice(0, 40));
        existing.add(p.toLowerCase());
      }
    }
    this.set('tags', next);
    this.tagInput.set('');
  }

  onTagKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    } else if (event.key === 'Backspace' && !this.tagInput() && this.draft().tags.length) {
      this.set('tags', this.draft().tags.slice(0, -1));
    }
  }

  removeTag(tag: string): void {
    this.set(
      'tags',
      this.draft().tags.filter((t) => t !== tag),
    );
  }

  pickIcon(icon: string): void {
    this.set('icon', icon);
    this.showIconPicker.set(false);
    this.iconSearch.set('');
  }

  // --- Markdown toolbar -----------------------------------------------------

  /** Wraps the selection (or inserts a placeholder) with markdown syntax. */
  wrap(before: string, after = before, placeholder = 'text'): void {
    const area = this.bodyArea()?.nativeElement;
    if (!area) return;
    const { selectionStart: start, selectionEnd: end, value } = area;
    const selected = value.slice(start, end) || placeholder;
    this.applyEdit(area, start, end, before + selected + after, start + before.length, start + before.length + selected.length);
  }

  /** Prefixes every selected line (headings, lists, quotes). */
  prefixLines(prefix: string | ((i: number) => string)): void {
    const area = this.bodyArea()?.nativeElement;
    if (!area) return;
    const { value } = area;
    const lineStart = value.lastIndexOf('\n', area.selectionStart - 1) + 1;
    let lineEnd = value.indexOf('\n', area.selectionEnd);
    if (lineEnd === -1) lineEnd = value.length;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const text = lines
      .map((l, i) => (typeof prefix === 'function' ? prefix(i) : prefix) + l.replace(/^(#{1,6} |[-*] |\d+\. |> )/, ''))
      .join('\n');
    this.applyEdit(area, lineStart, lineEnd, text, lineStart, lineStart + text.length);
  }

  insertBlock(block: string): void {
    const area = this.bodyArea()?.nativeElement;
    if (!area) return;
    const { selectionStart: start, value } = area;
    const pad = start > 0 && value[start - 1] !== '\n' ? '\n\n' : '';
    const text = pad + block + '\n';
    this.applyEdit(area, start, area.selectionEnd, text, start + text.length, start + text.length);
  }

  insertLink(): void {
    this.wrap('[', '](https://)', 'link text');
  }

  insertTable(): void {
    this.insertBlock('| Item | Details |\n|---|---|\n| Row 1 | … |\n| Row 2 | … |');
  }

  private applyEdit(
    area: HTMLTextAreaElement,
    start: number,
    end: number,
    text: string,
    selStart: number,
    selEnd: number,
  ): void {
    const value = area.value.slice(0, start) + text + area.value.slice(end);
    this.set('body_md', value);
    // Restore focus/selection after Angular re-renders the textarea value
    queueMicrotask(() => {
      area.value = value;
      area.focus();
      area.setSelectionRange(selStart, selEnd);
    });
  }

  onBodyKey(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === 'b') {
      event.preventDefault();
      this.wrap('**');
    } else if (event.key === 'i') {
      event.preventDefault();
      this.wrap('_');
    } else if (event.key === 's') {
      event.preventDefault();
      void this.save();
    }
  }

  // --- Save -----------------------------------------------------------------

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    const d = this.draft();
    const body: ServiceInput = {
      ...d,
      title: d.title.trim(),
      description: d.description.trim(),
      price: d.price.trim(),
      contact_phone: d.contact_phone.trim(),
      slug: d.slug?.trim() || undefined,
    };
    try {
      if (this.isNew()) {
        const created = await this.servicesService.create(body);
        this.saved.set(toInput(created));
        this.draft.set(toInput(created));
        this.toast.success('Service created');
        void this.router.navigate(['/services', created.id], { replaceUrl: true });
      } else {
        const updated = await this.servicesService.update(this.id(), body);
        this.existing.set(updated);
        this.saved.set(toInput(updated));
        this.draft.set(toInput(updated));
        this.toast.success('Changes saved');
      }
    } finally {
      this.saving.set(false);
    }
  }

  discard(): void {
    if (this.isNew()) {
      void this.router.navigate(['/services']);
      return;
    }
    const s = this.saved();
    this.draft.set({ ...s, tags: [...s.tags] });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }
}

function toInput(s: Service): ServiceInput {
  return {
    title: s.title,
    slug: s.slug,
    description: s.description,
    tags: [...(s.tags ?? [])],
    body_md: s.body_md ?? '',
    price: s.price ?? '',
    icon: s.icon ?? 'home_repair_service',
    icon_color: s.icon_color ?? 'slate',
    contact_phone: s.contact_phone ?? '',
    is_active: s.is_active,
  };
}
