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

  describe('Become a GST / ITR client', () => {
    async function openSheet(type: 'gst' | 'itr') {
      const fixture = await render();
      fixture.componentInstance.openServiceModal(type);
      fixture.detectChanges();
      return fixture;
    }
    const submitButton = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('[role=dialog] button[type=submit]')).find((b) => b.textContent?.includes('Submit Application')) as HTMLButtonElement;

    it('Submit stays visible and tappable; a wrong form explains every problem', async () => {
      const create = jasmine.createSpy('create');
      (TestBed.inject(ServiceRequestsService) as unknown as { create: jasmine.Spy }).create = create;
      const fixture = await openSheet('gst');
      const el: HTMLElement = fixture.nativeElement;
      const submit = submitButton(el);
      expect(submit.disabled).toBeFalse();

      fixture.componentInstance.gstServiceForm.patchValue({ gstin: '24ABCDE' });
      await fixture.componentInstance.submitGstRequest();
      fixture.detectChanges();
      const dialog = el.querySelector('[role=dialog]')!.textContent!;
      expect(create).not.toHaveBeenCalled();
      expect(dialog).toContain('Enter your business or trade name.');
      expect(dialog).toContain('GSTIN must be 15 characters (you entered 7).');
      expect(dialog).toContain('Select your industry.');
      // the summary sits right above the buttons, inside the sheet
      expect(submit.closest('div.shrink-0')?.querySelector('[role=alert]')?.textContent).toContain('Please fix the highlighted fields.');
    });

    it('an invalid GSTIN checksum and a server refusal are shown inside the sheet', async () => {
      const create = jasmine.createSpy('create').and.rejectWith({ error: { message: 'A request is already pending' } });
      (TestBed.inject(ServiceRequestsService) as unknown as { create: jasmine.Spy }).create = create;
      const fixture = await openSheet('gst');
      const c = fixture.componentInstance;
      c.gstServiceForm.patchValue({ business_name: 'Lohiya Traders', gstin: '24ABCDE1234F1Z9', industry: c.industries[0] });
      await c.submitGstRequest();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain("This GSTIN isn't valid.");
      expect(create).not.toHaveBeenCalled();

      c.gstServiceForm.patchValue({ gstin: '27AAPFU0939F1ZV' });
      await c.submitGstRequest();
      fixture.detectChanges();
      expect(create).toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[role=dialog] [role=alert]')?.textContent).toContain('A request is already pending');
    });

    it('ITR: a short PAN says how many characters were entered', async () => {
      const fixture = await openSheet('itr');
      fixture.componentInstance.itrServiceForm.patchValue({ pan: 'ABC12' });
      await fixture.componentInstance.submitItrRequest();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('PAN must be 10 characters (you entered 5).');
    });
  });
});
