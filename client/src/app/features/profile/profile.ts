import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ageValidator } from '../auth/signup';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CertificatesService,
  FamilyMembersService,
  ProfileService,
  ServiceRequestsService,
} from '../../core/services/feature.services';
import { CertType, ClientCertificate, FamilyMember, ServiceRequest } from '../../core/models';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { PushService } from '../../core/services/push.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { DatePipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { INDUSTRIES } from '../../../../../shared/constants/industries';
import { isValidGstin, isValidPan } from '../../../../../shared/constants/tax-validation';
import { FAMILY_RELATIONS, MAX_FAMILY_MEMBERS } from '../../../../../shared/constants/itr-year';

const PHOTO_KEY = 'fp_profile_photo';
const LANG_PREF_KEY = 'fp_language';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, TranslatePipe, DatePipe, UpperCasePipe],
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
  private readonly route = inject(ActivatedRoute);
  private readonly familyService = inject(FamilyMembersService);

  // --- Family members (ITR clients) ---
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly relations = FAMILY_RELATIONS;
  readonly maxFamilyMembers = MAX_FAMILY_MEMBERS;
  /** null = form closed, 'new' = adding, otherwise the member being edited. */
  readonly memberEditing = signal<string | null>(null);
  readonly memberForm = signal({ name: '', relation: 'spouse', pan: '' });
  readonly memberSaving = signal(false);
  readonly showFamily = computed(() => {
    const type = this.auth.userProfile()?.user_type;
    return type === 'itr' || type === 'both';
  });
  readonly memberPanInvalid = computed(() => {
    const pan = this.memberForm().pan.trim();
    return !!pan && !isValidPan(pan);
  });

  readonly photoUrl = computed(() => this.auth.userProfile()?.profile_photo_url || null);

  readonly certificates = signal<ClientCertificate[]>([]);
  readonly downloading = signal<string[]>([]);
  readonly serviceRequests = signal<ServiceRequest[]>([]);
  readonly pendingRequest = computed(() =>
    this.serviceRequests().find((r) => r.status === 'pending'),
  );
  readonly showServiceModal = signal<'gst' | 'itr' | null>(null);
  readonly serviceBusy = signal(false);
  /** Shown inside the application sheet, above its buttons (toasts sit behind the sheet's backdrop). */
  readonly serviceError = signal('');
  readonly industries = INDUSTRIES;

  readonly pushEnabled = signal(false);
  readonly pushSupported = signal(this.push.supported());
  readonly pushBusy = signal(false);
  readonly passwordBusy = signal(false);
  readonly passwordError = signal('');
  /** Set when Save is tapped with something missing, so the message shows next to the field. */
  readonly memberTried = signal(false);
  readonly bizTried = signal(false);
  readonly showDeleteModal = signal(false);
  readonly deleteBusy = signal(false);
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

  /** Which inline editor is open: date of birth, or business name + industry. */
  readonly editing = signal<'dob' | 'business' | null>(null);
  readonly dobDraft = signal(''); // YYYY-MM-DD from the date input
  readonly dobError = signal('');
  readonly bizDraft = signal({ business_name: '', industry: '' });
  /** Latest allowed date of birth: clients must be 18 (same rule as sign-up). */
  readonly maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

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

  readonly deleteForm = this.fb.nonNullable.group({
    password: ['', [Validators.required]],
  });

  readonly profileBusy = signal(false);

  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  constructor() {
    this.translate.use(this.currentLanguage());
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.loadProfile();
      void this.loadCertificates();
      void this.loadServiceRequests();
      if (this.showFamily()) await this.loadFamily();
    } catch {
      /* auth guard handles redirect */
    }
    
    if (this.push.supported()) {
      this.pushEnabled.set(await this.push.isSubscribed());
    }
  }

  private async loadFamily(): Promise<void> {
    try {
      this.familyMembers.set(await this.familyService.list());
    } catch {
      /* non-fatal */
    }
    // Arriving from the ITR tab's "Add family member" chip
    if (this.route.snapshot.queryParamMap.get('section') === 'family') {
      if (this.familyMembers().length < MAX_FAMILY_MEMBERS) this.editMember();
      setTimeout(() =>
        document.getElementById('family-members')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  }

  relationLabel(key: string): string {
    return FAMILY_RELATIONS.find((r) => r.key === key)?.label ?? key;
  }

  editMember(member?: FamilyMember): void {
    this.memberEditing.set(member?.id ?? 'new');
    this.memberForm.set({
      name: member?.name ?? '',
      relation: member?.relation ?? 'spouse',
      pan: member?.pan ?? '',
    });
  }

  setMemberField(key: 'name' | 'relation' | 'pan', value: string): void {
    this.memberForm.update((f) => ({ ...f, [key]: key === 'pan' ? value.toUpperCase() : value }));
  }

  async saveMember(): Promise<void> {
    const f = this.memberForm();
    const editing = this.memberEditing();
    this.memberTried.set(true);
    if (!editing || !f.name.trim() || this.memberPanInvalid() || this.memberSaving()) return;
    this.memberSaving.set(true);
    try {
      const body = { name: f.name.trim(), relation: f.relation, pan: f.pan.trim() };
      if (editing === 'new') {
        await this.familyService.create(body);
        this.toast.success(`${body.name} added`);
      } else {
        await this.familyService.update(editing, body);
        this.toast.success('Saved');
      }
      this.familyMembers.set(await this.familyService.list());
      this.memberEditing.set(null);
    } catch {
      /* toast handled by interceptor */
    } finally {
      this.memberSaving.set(false);
    }
  }

  async removeMember(member: FamilyMember): Promise<void> {
    if (!confirm(`Remove ${member.name}? Their ITR returns and documents will also be removed.`)) return;
    try {
      await this.familyService.remove(member.id);
      this.familyMembers.update((list) => list.filter((m) => m.id !== member.id));
      if (this.memberEditing() === member.id) this.memberEditing.set(null);
      this.toast.success(`${member.name} removed`);
    } catch {
      /* toast handled by interceptor */
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
    this.serviceError.set('');
    this.showServiceModal.set(type);
  }

  closeServiceModal(): void {
    this.showServiceModal.set(null);
  }

  /** Problem with one field of the GST/ITR application, shown under it once touched. */
  applicationError(field: 'business_name' | 'gstin' | 'industry' | 'pan'): string {
    const c = field === 'pan' ? this.itrServiceForm.get('pan') : this.gstServiceForm.get(field);
    if (!c?.touched) return '';
    const v = String(c.value ?? '').trim();
    switch (field) {
      case 'business_name':
        if (!v) return 'Enter your business or trade name.';
        return v.length < 2 ? 'This name is too short.' : '';
      case 'industry':
        return v ? '' : 'Select your industry.';
      case 'gstin':
        if (!v) return 'Enter your 15-character GSTIN.';
        if (v.length !== 15) return `GSTIN must be 15 characters (you entered ${v.length}).`;
        return isValidGstin(v) ? '' : "This GSTIN isn't valid. Please check it for typos.";
      case 'pan':
        if (!v) return 'Enter your 10-character PAN.';
        if (v.length !== 10) return `PAN must be 10 characters (you entered ${v.length}).`;
        return isValidPan(v) ? '' : 'PAN should look like ABCDE1234F.';
    }
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
    this.gstServiceForm.markAllAsTouched();
    const val = this.gstServiceForm.getRawValue();
    if (this.gstServiceForm.invalid || !isValidGstin(val.gstin)) {
      this.serviceError.set('Please fix the highlighted fields.');
      return;
    }
    this.serviceError.set('');
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
      this.serviceError.set(err?.error?.message || 'Failed to submit service request.');
    } finally {
      this.serviceBusy.set(false);
    }
  }

  async submitItrRequest(): Promise<void> {
    this.itrServiceForm.markAllAsTouched();
    const val = this.itrServiceForm.getRawValue();
    if (this.itrServiceForm.invalid || !isValidPan(val.pan)) {
      this.serviceError.set('Please fix the highlighted fields.');
      return;
    }
    this.serviceError.set('');
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
      this.serviceError.set(err?.error?.message || 'Failed to submit service request.');
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

  startDobEdit(): void {
    this.dobDraft.set(this.auth.userProfile()?.dob?.slice(0, 10) ?? '');
    this.dobError.set('');
    this.editing.set('dob');
  }

  async saveDob(): Promise<void> {
    const draft = this.dobDraft();
    const problem = ageValidator(18)(new FormControl(draft));
    if (!draft || problem) {
      this.dobError.set(
        problem?.['minAge'] ? 'You must be at least 18 years old.' : 'Please select a valid date of birth.',
      );
      return;
    }
    const [y, m, d] = draft.split('-');
    await this.saveProfileFields({ dob: `${d}/${m}/${y}` }, 'Date of birth updated.');
  }

  startBusinessEdit(): void {
    const p = this.auth.userProfile();
    this.bizDraft.set({ business_name: p?.business_name ?? '', industry: p?.industry ?? '' });
    this.bizTried.set(false);
    this.editing.set('business');
  }

  async saveBusiness(): Promise<void> {
    const { business_name, industry } = this.bizDraft();
    this.bizTried.set(true);
    if (business_name.trim().length < 2) return;
    await this.saveProfileFields({ business_name: business_name.trim(), industry }, 'Business details updated.');
  }

  /** GSTIN and PAN are not sent: only the CA changes those. */
  private async saveProfileFields(
    body: { dob?: string; business_name?: string; industry?: string },
    done: string,
  ): Promise<void> {
    this.profileBusy.set(true);
    try {
      await this.profileService.update(body);
      await this.auth.loadProfile();
      this.editing.set(null);
      this.toast.success(done);
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
    const { current_password, new_password, confirm } = form.getRawValue();
    if (!current_password || !new_password || !confirm) {
      this.passwordError.set('Fill in all three password fields.');
      return;
    }
    if (form.invalid) {
      this.passwordError.set('Passwords must be at least 8 characters.');
      return;
    }
    if (new_password !== confirm) {
      this.passwordError.set('New passwords do not match.');
      return;
    }
    this.passwordError.set('');
    this.passwordBusy.set(true);
    try {
      const { current_password, new_password } = form.getRawValue();
      await this.profileService.changePassword(current_password, new_password);
      this.toast.success('Password changed successfully.');
      form.reset();
    } catch (err: any) {
      this.passwordError.set(err?.error?.message || 'Could not change the password. Please try again.');
    } finally {
      this.passwordBusy.set(false);
    }
  }

  openDeleteModal(): void {
    this.deleteForm.reset();
    this.showDeleteModal.set(true);
  }

  async deleteAccount(): Promise<void> {
    if (this.deleteBusy()) return;
    if (this.deleteForm.invalid) {
      this.toast.error('Enter your password to confirm.');
      return;
    }
    this.deleteBusy.set(true);
    try {
      const { delete_after } = await this.profileService.deleteAccount(
        this.deleteForm.getRawValue().password,
      );
      const when = new Date(delete_after).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      this.showDeleteModal.set(false);
      this.toast.success(`Your account will be deleted on ${when}. Sign in before then to cancel.`);
      await this.auth.logout();
    } catch {
      /* interceptor toasts (e.g. wrong password) */
    } finally {
      this.deleteBusy.set(false);
    }
  }
}