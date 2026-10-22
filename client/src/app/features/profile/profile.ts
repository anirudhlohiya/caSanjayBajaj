import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CertificatesService,
  ProfileService,
  ServiceRequestsService,
} from '../../core/services/feature.services';
import { CertType, ClientCertificate, ServiceRequest } from '../../core/models';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { PushService } from '../../core/services/push.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { DatePipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { INDUSTRIES } from '../../../../../shared/constants/industries';
import { isValidGstin, isValidPan } from '../../../../../shared/constants/tax-validation';

const PHOTO_KEY = 'fp_profile_photo';
const LANG_PREF_KEY = 'fp_language';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DatePipe, UpperCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
})
export class Profile {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);
  private readonly certificatesService = inject(CertificatesService);
  private readonly serviceRequestsService = inject(ServiceRequestsService);
  readonly theme = inject(ThemeService);
  private readonly push = inject(PushService);
  readonly translate = inject(TranslateService);

  readonly photoUrl = computed(() => this.auth.userProfile()?.profile_photo_url || null);

  readonly certificates = signal<ClientCertificate[]>([]);
  readonly downloading = signal<string[]>([]);
  readonly serviceRequests = signal<ServiceRequest[]>([]);
  readonly pendingRequest = computed(() =>
    this.serviceRequests().find((r) => r.status === 'pending'),
  );
  readonly showServiceModal = signal<'gst' | 'itr' | null>(null);
  readonly serviceBusy = signal(false);
  readonly industries = INDUSTRIES;

  readonly pushEnabled = signal(false);
  readonly pushSupported = signal(this.push.supported());
  readonly pushBusy = signal(false);
  readonly passwordBusy = signal(false);
  readonly showPaymentModal = signal(false);
  
  readonly currentLanguage = signal(localStorage.getItem(LANG_PREF_KEY) || 'en');

  readonly themeOptions: { label: string; value: ThemeMode; icon: string }[] = [
    { label: 'System Default', value: 'system', icon: 'devices' },
    { label: 'Light', value: 'light', icon: 'light_mode' },
    { label: 'Dark', value: 'dark', icon: 'dark_mode' },
  ];

  readonly langOptions = [
    { label: 'English', value: 'en' },
    { label: 'हिंदी (Hindi)', value: 'hi' },
    { label: 'ગુજરાતી (Gujarati)', value: 'gu' }
  ];

  readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.pattern(/^\d{10}$/)]],
    dob: ['', [Validators.pattern(/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d{2}$/)]],
  });

  readonly gstServiceForm = this.fb.nonNullable.group({
    business_name: ['', [Validators.required, Validators.minLength(2)]],
    gstin: ['', [Validators.required, Validators.minLength(15), Validators.maxLength(15)]],
    filing_frequency: ['monthly' as 'monthly' | 'quarterly', [Validators.required]],
    industry: ['', [Validators.required]],
  });

  readonly itrServiceForm = this.fb.nonNullable.group({
    pan: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10)]],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    current_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  readonly profileBusy = signal(false);

  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  constructor() {
    this.translate.use(this.currentLanguage());
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.loadProfile();
      this.populateProfileForm();
      void this.loadCertificates();
      void this.loadServiceRequests();
    } catch {
      /* auth guard handles redirect */
    }
    
    if (this.push.supported()) {
      this.pushEnabled.set(await this.push.isSubscribed());
    }
  }

  async loadServiceRequests(): Promise<void> {
    try {
      this.serviceRequests.set(await this.serviceRequestsService.myRequests());
    } catch {
      /* ignore */
    }
  }

  openServiceModal(type: 'gst' | 'itr'): void {
    if (type === 'gst') {
      this.gstServiceForm.reset({
        business_name: '',
        gstin: '',
        filing_frequency: 'monthly',
        industry: '',
      });
    } else {
      this.itrServiceForm.reset({
        pan: '',
      });
    }
    this.showServiceModal.set(type);
  }

  closeServiceModal(): void {
    this.showServiceModal.set(null);
  }

  isGstinChecksumValid(gstin?: string | null): boolean {
    if (!gstin) return false;
    return isValidGstin(gstin);
  }

  isPanValid(pan?: string | null): boolean {
    if (!pan) return false;
    return isValidPan(pan);
  }

  async submitGstRequest(): Promise<void> {
    if (this.gstServiceForm.invalid) {
      this.gstServiceForm.markAllAsTouched();
      return;
    }
    const val = this.gstServiceForm.getRawValue();
    if (!isValidGstin(val.gstin)) {
      this.toast.error('Invalid GSTIN checksum or format (15 characters expected).');
      return;
    }
    this.serviceBusy.set(true);
    try {
      await this.serviceRequestsService.create({
        requested_type: 'gst',
        business_name: val.business_name.trim(),
        gstin: val.gstin.trim().toUpperCase(),
        filing_frequency: val.filing_frequency,
        industry: val.industry,
      });
      this.toast.success('GST service request submitted! Under review by your CA.');
      this.closeServiceModal();
      await this.loadServiceRequests();
    } catch (err: any) {
      this.toast.error(err?.error?.message || 'Failed to submit service request.');
    } finally {
      this.serviceBusy.set(false);
    }
  }

  async submitItrRequest(): Promise<void> {
    if (this.itrServiceForm.invalid) {
      this.itrServiceForm.markAllAsTouched();
      return;
    }
    const val = this.itrServiceForm.getRawValue();
    if (!isValidPan(val.pan)) {
      this.toast.error('Invalid PAN format (e.g. ABCDE1234F).');
      return;
    }
    this.serviceBusy.set(true);
    try {
      await this.serviceRequestsService.create({
        requested_type: 'itr',
        pan: val.pan.trim().toUpperCase(),
      });
      this.toast.success('ITR service request submitted! Under review by your CA.');
      this.closeServiceModal();
      await this.loadServiceRequests();
    } catch (err: any) {
      this.toast.error(err?.error?.message || 'Failed to submit service request.');
    } finally {
      this.serviceBusy.set(false);
    }
  }

  userTypeLabel(type?: string): string {
    switch (type) {
      case 'gst':
        return 'GST Client';
      case 'itr':
        return 'ITR Client';
      case 'both':
        return 'GST & ITR Client';
      case 'general':
      default:
        return 'Standard Client';
    }
  }

  private populateProfileForm(): void {
    const profile = this.auth.userProfile();
    if (!profile) return;
    const dobStr = profile.dob ? this.formatDateToDDMMYYYY(profile.dob) : '';
    this.profileForm.patchValue({
      name: profile.name || '',
      phone: profile.phone || '',
      dob: dobStr,
    });
  }

  private formatDateToDDMMYYYY(date: string | Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.profileBusy.set(true);
    try {
      const { name, phone, dob } = this.profileForm.getRawValue();
      await this.profileService.update({
        name,
        phone: phone || undefined,
        dob: dob || undefined,
      });
      await this.auth.loadProfile();
      this.toast.success('Profile updated successfully.');
    } catch {
      /* interceptor toasts */
    } finally {
      this.profileBusy.set(false);
    }
  }

  async loadCertificates(): Promise<void> {
    try {
      this.certificates.set(await this.certificatesService.list());
    } catch {
      /* interceptor toasts */
    }
  }

  certFor(certType: CertType): ClientCertificate | undefined {
    return this.certificates().find((c) => c.cert_type === certType);
  }

  async downloadCertificate(cert: ClientCertificate): Promise<void> {
    this.downloading.update((l) => [...l, cert.id]);
    try {
      const { download_url } = await this.certificatesService.downloadUrl(cert.id);
      window.open(download_url, '_blank');
    } catch {
      /* interceptor toasts */
    } finally {
      this.downloading.update((l) => l.filter((x) => x !== cert.id));
    }
  }

  triggerPhotoUpload(): void {
    this.photoInput.nativeElement.click();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('Image must be under 5 MB.');
      return;
    }
    this.profileBusy.set(true);
    try {
      await this.auth.uploadProfilePhoto(file);
      this.toast.success('Profile photo updated.');
    } catch {
      // API client or interceptor usually handles toasts, but fallback
    } finally {
      this.profileBusy.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  initials(): string {
    const name = this.auth.userProfile()?.name;
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
    this.toast.success(`Theme set to ${mode === 'system' ? 'system default' : mode + ' mode'}.`);
  }

  setLanguage(lang: string): void {
    this.currentLanguage.set(lang);
    localStorage.setItem(LANG_PREF_KEY, lang);
    this.translate.use(lang);
  }

  downloadQR(): void {
    const link = document.createElement('a');
    link.href = '/payment-qr.jpeg';
    link.download = 'payment-qr.jpeg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async togglePush(enabled: boolean): Promise<void> {
    if (this.pushBusy()) return;
    this.pushBusy.set(true);
    try {
      if (enabled) {
        const ok = await this.push.requestAndSubscribe();
        if (!ok) {
          this.toast.error('Push notifications could not be enabled for this browser.');
          return;
        }
      } else {
        await this.push.unsubscribe();
      }
      this.pushEnabled.set(enabled);
      this.toast.success(enabled ? 'Push notifications enabled.' : 'Push notifications disabled.');
    } finally {
      this.pushBusy.set(false);
    }
  }

  async changePassword(): Promise<void> {
    const form = this.passwordForm;
    if (form.invalid) {
      this.toast.error('Passwords must be at least 8 characters.');
      return;
    }
    if (form.getRawValue().new_password !== form.getRawValue().confirm) {
      this.toast.error('New passwords do not match.');
      return;
    }
    this.passwordBusy.set(true);
    try {
      const { current_password, new_password } = form.getRawValue();
      await this.profileService.changePassword(current_password, new_password);
      this.toast.success('Password changed successfully.');
      form.reset();
    } catch {
      /* interceptor toasts */
    } finally {
      this.passwordBusy.set(false);
    }
  }
}