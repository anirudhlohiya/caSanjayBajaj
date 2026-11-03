import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateLoader, TranslateNoOpLoader, provideTranslateService } from '@ngx-translate/core';
import { UserProfile } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import {
  CertificatesService,
  FamilyMembersService,
  ProfileService,
  ServiceRequestsService,
} from '../../core/services/feature.services';
import { PushService } from '../../core/services/push.service';
import { Profile } from './profile';

const gstClient = {
  id: 'u1', name: 'Anirudh Lohiya', email: 'anirudh@example.com', phone: '9316527283',
  gstin: '24ABCDE1234F1Z5', business_name: 'Lohiya Traders', industry: 'Retail trade', pan: 'ABCDE1234F',
  user_type: 'gst', status: 'active', gst_filing_frequency: 'monthly', dob: '2003-10-06',
} as unknown as UserProfile;

describe('Profile screen', () => {
  const profile = signal<UserProfile | null>(null);
  let update: jasmine.Spy;
  let certs: object[];

  beforeEach(async () => {
    profile.set(gstClient);
    certs = [];
    update = jasmine.createSpy('update').and.resolveTo({});
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: TranslateNoOpLoader } }),
        { provide: AuthService, useValue: { userProfile: profile, loadProfile: async () => profile(), logout: () => undefined } },
        { provide: ProfileService, useValue: { update } },
        { provide: CertificatesService, useValue: { list: async () => certs, downloadUrl: async () => ({ download_url: '#' }) } },
        { provide: ServiceRequestsService, useValue: { myRequests: async () => [] } },
        { provide: FamilyMembersService, useValue: { list: async () => [] } },
        { provide: PushService, useValue: { supported: () => false } },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows personal details with only the date of birth editable', async () => {
    const el: HTMLElement = (await render()).nativeElement;
    expect(el.textContent).toContain('6 Oct 2003');
    expect(el.querySelectorAll('[aria-label="Edit date of birth"]').length).toBe(1);
    expect(el.querySelector('[aria-label="Edit full name"], [aria-label="Edit phone"]')).toBeNull();
    expect(el.textContent).toContain('GST Client');
  });

  it('refuses an under-18 date of birth and saves a valid one as DD/MM/YYYY', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    c.startDobEdit();
    expect(c.dobDraft()).toBe('2003-10-06');

    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 17);
    c.dobDraft.set(tooYoung.toISOString().split('T')[0]);
    await c.saveDob();
    fixture.detectChanges();
    expect(update).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain('at least 18');

    c.dobDraft.set('1990-05-21');
    await c.saveDob();
    expect(update).toHaveBeenCalledWith({ dob: '21/05/1990' });
    expect(c.editing()).toBeNull();
  });

  it('edits business name and industry only; GSTIN and PAN stay with the CA', async () => {
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('24ABCDE1234F1Z5');
    expect(el.textContent).toContain('To change your GSTIN or PAN, contact your CA.');

    const c = fixture.componentInstance;
    c.startBusinessEdit();
    c.bizDraft.set({ business_name: '  Lohiya & Sons  ', industry: 'Manufacturing' });
    await c.saveBusiness();
    expect(update).toHaveBeenCalledWith({ business_name: 'Lohiya & Sons', industry: 'Manufacturing' });
  });

  it('offers a download button only for certificates that exist', async () => {
    certs = [{ id: 'c1', cert_type: 'gst_cert', original_filename: 'gst-certificate.pdf' }];
    const el: HTMLElement = (await render()).nativeElement;
    const buttons = el.querySelectorAll('button[aria-label^="Download "]');
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute('aria-label')).toBe('Download gst-certificate.pdf');
    expect(el.textContent).toContain('Not uploaded yet'); // Udyam
  });
});
