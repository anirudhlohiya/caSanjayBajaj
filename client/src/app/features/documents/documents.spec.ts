import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  ComplianceTasksService,
  DocumentsService,
  FamilyMembersService,
  ItrReturnsService,
  PeriodsService,
  ReportRequestsService,
  ReportsService,
} from '../../core/services/feature.services';
import { Documents } from './documents';

const page = (items: object[]) => ({ items, total: items.length, page: 1, pageSize: 20, totalPages: 1 });

describe('Documents screen', () => {
  const profile = signal<{ user_type: string; gst_filing_frequency?: string } | null>(null);
  let docs: jasmine.SpyObj<DocumentsService>;
  let tasks: jasmine.SpyObj<ComplianceTasksService>;

  beforeEach(async () => {
    docs = jasmine.createSpyObj<DocumentsService>('DocumentsService', ['list']);
    docs.list.and.callFake(async (opts) =>
      page(
        opts?.category === 'general'
          ? [{ id: 'g1', original_filename: 'partnership-deed.pdf', file_size: 120_000, status: 'processed', created_at: '2026-10-23T05:00:00Z', mime_type: 'application/pdf' }]
          : [{ id: 'd1', original_filename: 'Sales-register-Oct.xlsx', file_size: 126_000, status: 'pending', created_at: '2026-10-23T05:00:00Z', mime_type: 'application/vnd.ms-excel' }],
      ) as never,
    );
    tasks = jasmine.createSpyObj<ComplianceTasksService>('ComplianceTasksService', ['list', 'markNil']);
    tasks.list.and.resolveTo([
      { id: 't1', category: 'gstr_1', status: 'uploaded' },
      { id: 't2', category: 'gstr_3b', status: 'pending' },
      { id: 't3', category: 'iff', status: 'pending' },
      { id: 't4', category: 'gst_payment', status: 'pending' },
    ] as never);

    await TestBed.configureTestingModule({
      imports: [Documents],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { userProfile: profile } },
        { provide: DocumentsService, useValue: docs },
        { provide: ComplianceTasksService, useValue: tasks },
        {
          provide: PeriodsService,
          useValue: { list: async () => [{ id: 'p-oct', period_label: 'October 2026', period_code: '2026-10', due_date: '2026-11-11' }] },
        },
        { provide: ReportsService, useValue: { list: async () => page([]) } },
        { provide: ItrReturnsService, useValue: { listMine: async () => [] } },
        { provide: FamilyMembersService, useValue: { list: async () => [] } },
        { provide: ReportRequestsService, useValue: {} },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(Documents);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('a general client gets no switch, just their general documents', async () => {
    profile.set({ user_type: 'general' });
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role=tablist]')).toBeNull();
    expect(el.textContent).toContain('partnership-deed.pdf');
    expect(docs.list).toHaveBeenCalledWith(jasmine.objectContaining({ category: 'general' }));
  });

  it('a GST client sees GST first, with progress over the documents to upload', async () => {
    profile.set({ user_type: 'gst', gst_filing_frequency: 'monthly' });
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(el.querySelectorAll('[role=tab]'));
    // icons are aria-hidden, so only the label is read out
    expect(tabs.map((t) => t.querySelector('span:not([aria-hidden])')?.textContent?.trim())).toEqual(['GST', 'General']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tasks.list).toHaveBeenCalledWith('p-oct');
    // GST payment is info-only, so 1 of 3 upload tasks is done
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('1 / 3');
    expect((el.querySelector('.bg-gold') as HTMLElement).style.width).toBe('33%');
    expect(el.textContent).toContain('Required');
    expect(el.textContent).toContain('File Nil'); // IFF can be filed nil
  });

  it('switching to General loads the general documents', async () => {
    profile.set({ user_type: 'gst' });
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;
    (Array.from(el.querySelectorAll('[role=tab]')).pop() as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(docs.list).toHaveBeenCalledWith(jasmine.objectContaining({ category: 'general' }));
    expect(el.textContent).toContain('partnership-deed.pdf');
  });
});
