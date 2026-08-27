import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastContainer } from '../../shared/components/toast-container';
import { AuthLayout } from '../../shared/components/auth-layout';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, ToastContainer, RouterLink, AuthLayout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
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

  readonly resetForm = this.fb.nonNullable.group({
    otp_code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required]],
  });

  async requestOtp(): Promise<void> {
    if (this.emailForm.invalid || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    try {
      const email = this.emailForm.controls.email.value;
      await this.auth.sendOtp(email, 'reset_password');
      this.toast.info('Reset OTP sent to your email.');
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

  async verifyAndReset(): Promise<void> {
    if (this.resetForm.invalid || this.loading()) return;

    const { otp_code, password, confirm_password } = this.resetForm.getRawValue();

    if (password !== confirm_password) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.error.set('');
    this.loading.set(true);
    try {
      const email = this.emailForm.controls.email.value;
      await this.auth.verifyOtp(email, otp_code, 'reset_password');
      await this.auth.resetPassword(email, password);
      this.toast.success('Password reset successfully!');
      await this.router.navigate(['/login']);
    } catch (err) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ??
          'Failed to verify and reset password. Please try again.',
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
