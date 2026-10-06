import { ChangeDetectionStrategy, Component, inject, signal, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export function ageValidator(minAge: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const today = new Date();
    const birthDate = new Date(control.value);
    if (isNaN(birthDate.getTime())) return { invalidDate: true };

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < minAge) {
      return { minAge: { requiredAge: minAge, actualAge: age } };
    }
    return null;
  };
}
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastContainer } from '../../shared/components/toast-container';
import { AuthLayout } from '../../shared/components/auth-layout';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, ToastContainer, RouterLink, AuthLayout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signup.html',
})
export class Signup implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly step = signal<'email' | 'verify'>('email');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly resendOtpCooldown = signal(0);
  private cooldownInterval?: any;

  ngOnDestroy(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }

  readonly maxDob: string;

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly signupForm = this.fb.nonNullable.group({
    otp_code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    name: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    dob: ['', [Validators.required, ageValidator(18)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required]],
  });

  constructor() {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 18);
    this.maxDob = today.toISOString().split('T')[0];
    
    this.signupForm.controls.otp_code.valueChanges.subscribe(val => {
      if (val?.length === 6 && !this.otpVerified() && !this.otpVerifying()) {
        this.onOtpInput();
      }
    });
  }
  async requestOtp(): Promise<void> {
    if (this.emailForm.invalid || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    try {
      const email = this.emailForm.controls.email.value;
      await this.auth.sendOtp(email, 'signup');
      this.toast.info('Verification OTP sent to your email.');
      this.step.set('verify');
      this.startCooldown();
    } catch (err) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ??
          'Failed to send OTP. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  startCooldown(): void {
    this.resendOtpCooldown.set(30);
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    this.cooldownInterval = setInterval(() => {
      const current = this.resendOtpCooldown();
      if (current > 0) {
        this.resendOtpCooldown.set(current - 1);
      } else {
        clearInterval(this.cooldownInterval);
      }
    }, 1000);
  }

  async resendOtp(): Promise<void> {
    if (this.resendOtpCooldown() > 0 || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    try {
      const email = this.emailForm.controls.email.value;
      await this.auth.sendOtp(email, 'signup');
      this.toast.info('OTP resent to your email.');
      this.startCooldown();
    } catch (err) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ??
          'Failed to resend OTP. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  readonly otpVerified = signal(false);
  readonly otpVerifying = signal(false);

  async onOtpInput(): Promise<void> {
    const otp = this.signupForm.controls.otp_code.value;
    if (otp.length === 6 && !this.otpVerified() && !this.otpVerifying()) {
      this.error.set('');
      this.otpVerifying.set(true);
      try {
        const email = this.emailForm.controls.email.value;
        await this.auth.verifyOtp(email, otp, 'signup');
        this.otpVerified.set(true);
        this.signupForm.controls.otp_code.disable();
        this.toast.success('OTP verified successfully!');
      } catch (err) {
        this.error.set(
          (err as { error?: { message?: string } })?.error?.message ??
            'Invalid OTP. Please try again.',
        );
      } finally {
        this.otpVerifying.set(false);
      }
    }
  }

  async verifyAndSignup(): Promise<void> {
    if (this.signupForm.invalid || this.loading()) return;
    if (!this.otpVerified()) {
      this.error.set('Please verify OTP first.');
      return;
    }

    const { name, phone, dob, password, confirm_password } = this.signupForm.getRawValue();

    if (password !== confirm_password) {
      this.error.set('Passwords do not match.');
      return;
    }

    // Convert YYYY-MM-DD to DD/MM/YYYY for backend
    let formattedDob = dob;
    if (dob && dob.includes('-')) {
      const [year, month, day] = dob.split('-');
      formattedDob = `${day}/${month}/${year}`;
    }

    this.error.set('');
    this.loading.set(true);
    try {
      const email = this.emailForm.controls.email.value;
      await this.auth.signup(email, password, name, phone, formattedDob);
      this.toast.success('Registration successful!');
      // Ask for notification permission after signup
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      await this.router.navigate(['/dashboard'], { replaceUrl: true });
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
