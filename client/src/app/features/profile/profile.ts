import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
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
} from '../../core/services/feature.services';
import { CertType, ClientCertificate } from '../../core/models';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { PushService } from '../../core/services/push.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

const PHOTO_KEY = 'fp_profile_photo';
const LANG_PREF_KEY = 'fp_language';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
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
  readonly theme = inject(ThemeService);
  private readonly push = inject(PushService);
  readonly translate = inject(TranslateService);

  readonly photoUrl = signal<string | null>(localStorage.getItem(PHOTO_KEY));
  readonly certificates = signal<ClientCertificate[]>([]);
  readonly downloading = signal<string[]>([]);

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

  readonly passwordForm = this.fb.nonNullable.group({
    current_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  constructor() {
    this.translate.use(this.currentLanguage());
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.loadProfile();
      void this.loadCertificates();
    } catch {
      /* auth guard handles redirect */
    }
    
    if (this.push.supported()) {
      this.pushEnabled.set(await this.push.isSubscribed());
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

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.toast.error('Image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      localStorage.setItem(PHOTO_KEY, dataUrl);
      this.photoUrl.set(dataUrl);
      this.toast.success('Profile photo updated.');
    };
    reader.readAsDataURL(file);
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