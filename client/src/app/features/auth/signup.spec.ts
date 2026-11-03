import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ForgotPassword } from './forgot-password';
import { Signup, ageValidator } from './signup';

function yearsAgo(years: number, extraDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + extraDays);
  return d.toISOString().split('T')[0];
}

describe('ageValidator', () => {
  const check = (v: string) => ageValidator(18)(new FormControl(v));

  it('accepts someone who turned 18 today', () => {
    expect(check(yearsAgo(18))).toBeNull();
  });

  it('rejects someone who turns 18 tomorrow', () => {
    expect(check(yearsAgo(18, 1))?.['minAge']).toBeTruthy();
  });

  it('leaves an empty value to the required validator', () => {
    expect(check('')).toBeNull();
  });
});

describe('Auth screens (create account, reset password)', () => {
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['sendOtp', 'verifyOtp', 'signup', 'resetPassword']);
    auth.sendOtp.and.resolveTo(undefined as never);
    await TestBed.configureTestingModule({
      imports: [Signup, ForgotPassword],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  function typeInto(el: HTMLElement, id: string, value: string) {
    const input = el.querySelector('#' + id) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('create account: sends the code, then shows the details form with Register locked until the code is verified', async () => {
    const fixture = TestBed.createComponent(Signup);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect((el.querySelector('#email') as HTMLInputElement).placeholder).toBe('sanjay@example.com');

    typeInto(el, 'email', 'sanjay@example.com');
    // The resend countdown keeps a timer running, so await the action itself.
    await fixture.componentInstance.requestOtp();
    fixture.detectChanges();

    expect(auth.sendOtp).toHaveBeenCalledWith('sanjay@example.com', 'signup');
    expect(el.textContent).toContain('Verifying:');
    const register = Array.from(el.querySelectorAll('button[type=submit]')).find((b) =>
      b.textContent?.includes('Register'),
    ) as HTMLButtonElement;
    // Register stays tappable; an incomplete form says what to fix next to the button
    expect(register.disabled).toBeFalse();
    await fixture.componentInstance.verifyAndSignup();
    fixture.detectChanges();
    expect(auth.signup).not.toHaveBeenCalled();
    const alert = register.previousElementSibling;
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('Please fix the highlighted fields.');
    expect(el.textContent).toContain('Enter the 6-digit code from your email.');
    expect(el.textContent).toContain('Enter your full name.');
    fixture.destroy();
  });

  it('create account: one eye button shows both password fields', async () => {
    const fixture = TestBed.createComponent(Signup);
    fixture.componentInstance.step.set('verify');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('button[aria-pressed]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((el.querySelector('#password') as HTMLInputElement).type).toBe('text');
    expect((el.querySelector('#confirm_password') as HTMLInputElement).type).toBe('text');
  });

  it('reset password: verifies the code, then sets the new password', async () => {
    auth.verifyOtp.and.resolveTo(undefined as never);
    auth.resetPassword.and.resolveTo(undefined as never);
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    typeInto(el, 'email', 'sanjay@example.com');
    await fixture.componentInstance.requestOtp();
    fixture.detectChanges();
    expect(auth.sendOtp).toHaveBeenCalledWith('sanjay@example.com', 'reset_password');

    typeInto(el, 'otp_code', '123456');
    typeInto(el, 'new_password', 'newpassword1');
    typeInto(el, 'confirm_password', 'newpassword1');
    fixture.detectChanges();
    await fixture.componentInstance.verifyAndReset();

    expect(auth.verifyOtp).toHaveBeenCalledWith('sanjay@example.com', '123456', 'reset_password');
    expect(auth.resetPassword).toHaveBeenCalledWith('sanjay@example.com', 'newpassword1');
  });
});
