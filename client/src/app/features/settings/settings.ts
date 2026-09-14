import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileService } from '../../core/services/feature.services';
import { PushService } from '../../core/services/push.service';
import { PageHeader } from '../../shared/components/page-header';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

const EMAIL_PREF_KEY = 'fp_email_enabled';
const LANG_PREF_KEY = 'fp_language';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.html',
})
export class Settings {
  readonly theme = inject(ThemeService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly profileService = inject(ProfileService);
  private readonly push = inject(PushService);
  readonly translate = inject(TranslateService);
  readonly router = inject(Router);

  readonly pushEnabled = signal(false);
  readonly emailEnabled = signal(localStorage.getItem(EMAIL_PREF_KEY) !== '0');
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

  constructor() {
    this.translate.use(this.currentLanguage());
  }

  async ngOnInit(): Promise<void> {
    if (this.push.supported()) {
      this.pushEnabled.set(await this.push.isSubscribed());
    }
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

  toggleEmail(enabled: boolean): void {
    localStorage.setItem(EMAIL_PREF_KEY, enabled ? '1' : '0');
    this.emailEnabled.set(enabled);
    this.toast.success(enabled ? 'Email notifications enabled.' : 'Email notifications disabled.');
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
