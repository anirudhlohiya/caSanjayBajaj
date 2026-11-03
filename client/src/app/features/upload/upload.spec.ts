import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FamilyMembersService, PeriodsService } from '../../core/services/feature.services';
import { UploadQueueService } from '../../core/services/upload-queue.service';
import { UploadService, uploadErrorReason } from '../../core/services/upload.service';
import { Upload } from './upload';

describe('uploadErrorReason', () => {
  it("uses the server's message when there is one", () => {
    expect(uploadErrorReason({ status: 403, error: { message: 'You do not have access to gst documents' } })).toBe(
      'You do not have access to gst documents',
    );
    expect(uploadErrorReason({ status: 400, error: { message: ['file too big', 'bad type'] } })).toBe('file too big. bad type');
  });

  it('falls back to a plain reason by status', () => {
    expect(uploadErrorReason({ status: 415 })).toBe("This file type isn't allowed");
    expect(uploadErrorReason({ status: 413 })).toBe('This file is too large');
    expect(uploadErrorReason({ status: 500, error: { message: '  ' } })).toBe('Something went wrong. Please try again');
  });
});

function code(monthsAgo: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

describe('Upload screen', () => {
  const profile = signal<{ user_type: string } | null>(null);
  let upload: jasmine.SpyObj<UploadService>;

  beforeEach(async () => {
    upload = jasmine.createSpyObj<UploadService>('UploadService', ['uploadFile', 'processQueue']);
    await TestBed.configureTestingModule({
      imports: [Upload],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { userProfile: profile, loadProfile: async () => profile() } },
        {
          provide: PeriodsService,
          // newest first, as the API returns them
          useValue: {
            open: async () => [
              { id: 'next', period_label: 'Next month', period_code: code(-1), due_date: '2027-01-11' },
              { id: 'this', period_label: 'This month', period_code: code(0), due_date: '2026-12-11' },
              { id: 'last', period_label: 'Last month', period_code: code(1), due_date: '2026-11-11' },
              { id: 'older', period_label: 'Two months ago', period_code: code(2), due_date: '2026-10-11' },
            ],
          },
        },
        { provide: UploadService, useValue: upload },
        { provide: UploadQueueService, useValue: { list: async () => [], remove: async () => undefined } },
        { provide: FamilyMembersService, useValue: { list: async () => [] } },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(Upload);
    fixture.detectChanges();
    await fixture.componentInstance.init();
    fixture.detectChanges();
    return fixture;
  }

  it("a GST client starts on last month's filing period", async () => {
    profile.set({ user_type: 'gst' });
    const fixture = await render();
    expect(fixture.componentInstance.selectedPeriodId()).toBe('last');
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Upload GST Documents');
  });

  it('a general client uploads general documents, with no period picker', async () => {
    profile.set({ user_type: 'general' });
    const fixture = await render();
    expect(fixture.componentInstance.category()).toBe('general');
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Upload General Documents');
  });

  it("shows the server's reason under a failed file", async () => {
    profile.set({ user_type: 'general' });
    upload.uploadFile.and.callFake(async (_f, _o, _p, onError) => {
      onError?.("This file type isn't allowed");
      return 'failed';
    });
    const fixture = await render();
    fixture.componentInstance.addFile(new File(['x'], 'scan.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();
    await fixture.componentInstance.uploadAll();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Upload failed: This file type isn't allowed");
    // a failed file can be sent again
    expect(fixture.nativeElement.textContent).toContain('Upload 1 file');
  });

  it('refuses files over 50 MB before uploading', async () => {
    profile.set({ user_type: 'general' });
    const fixture = await render();
    const big = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 51 * 1024 * 1024 });
    fixture.componentInstance.addFile(big);
    expect(fixture.componentInstance.items().length).toBe(0);
  });
});
