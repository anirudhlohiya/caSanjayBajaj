import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/feature.services';
import { PushService } from '../../core/services/push.service';

const PUSH_PREF_KEY = 'fp_push_enabled';
const EMAIL_PREF_KEY = 'fp_email_enabled';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
})
export class Profile {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly push = inject(PushService);

  readonly pushEnabled = signal(localStorage.getItem(PUSH_PREF_KEY) === '1');
  readonly emailEnabled = signal(localStorage.getItem(EMAIL_PREF_KEY) !== '0');
  readonly pushSupported = signal(true);
  readonly pushBusy = signal(false);
  readonly savingPhone = signal(false);
  readonly passwordBusy = signal(false);

  readonly phoneForm = this.fb.nonNullable.group({
    phone: ['', [Validators.pattern(/^[0-9+\-\s]{10,20}$/)]],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    current_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.loadProfile();
    } catch {
      /* auth guard handles redirect */
    }
    this.pushSupported.set(this.push.supported());
    if (this.push.supported()) {
      this.pushEnabled.set(await this.push.isSubscribed());
    }
    const profile = this.auth.userProfile();
    if (profile?.phone) {
      this.phoneForm.controls.phone.setValue(profile.phone);
    }
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
      localStorage.setItem(PUSH_PREF_KEY, enabled ? '1' : '0');
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

  async savePhone(): Promise<void> {
    if (this.phoneForm.invalid) {
      this.toast.error('Enter a valid phone number.');
      return;
    }
    this.savingPhone.set(true);
    try {
      const { phone } = this.phoneForm.getRawValue();
      await this.profileService.update({ phone: phone || undefined });
      await this.auth.loadProfile();
      this.toast.success('Phone number updated.');
    } catch {
      /* interceptor toasts */
    } finally {
      this.savingPhone.set(false);
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

  initials(): string {
    const name = this.auth.userProfile()?.name;
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }
}