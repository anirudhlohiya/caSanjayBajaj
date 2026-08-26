import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastContainer } from '../../shared/components/toast-container';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, ToastContainer, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signup.html',
})
export class Signup {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly step = signal<'email' | 'verify'>('email');
  readonly loading = signal(false);
  readonly error = signal('');

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly signupForm = this.fb.nonNullable.group({
    otp_code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    name: ['', [Validators.required]],
    phone: [''],
    gstin: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required]],
  });

  async requestOtp(): Promise<void> {
    if (this.emailForm.invalid || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    try {
      const email = this.emailForm.controls.email.value;
      await this.auth.sendOtp(email, 'signup');
      this.toast.info('Verification OTP sent to your email.');
      this.step.set('verify');
    } catch (err) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ??
          'Failed to send OTP. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async verifyAndSignup(): Promise<void> {
    if (this.signupForm.invalid || this.loading()) return;

    const { otp_code, name, phone, gstin, password, confirm_password } = this.signupForm.getRawValue();

    if (password !== confirm_password) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.error.set('');
    this.loading.set(true);
    try {
      const email = this.emailForm.controls.email.value;
      await this.auth.verifyOtp(email, otp_code, 'signup');
      await this.auth.signup(email, password, name, phone || undefined, gstin?.toUpperCase() || undefined);
      this.toast.success('Registration successful!');
      // Ask for notification permission after signup
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ??
          'Failed to verify and register. Please check details and try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  backToEmail(): void {
    this.step.set('email');
    this.error.set('');
  }
}
