import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Login } from './login';

describe('Login screen', () => {
  let auth: jasmine.SpyObj<AuthService>;

  function render() {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const q = <T extends Element>(s: string) => el.querySelector(s) as T;
    const type = (id: string, value: string) => {
      const input = q<HTMLInputElement>('#' + id);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    };
    return { fixture, el, q, type };
  }

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('shows the round logo, firm name and the sign-in title', () => {
    const { el, q } = render();
    expect(q<HTMLImageElement>('img').getAttribute('src')).toBe('/logo-round.webp');
    expect(el.textContent).toContain('S N Bajaj & Co');
    expect(q('h1').textContent).toContain('Sign in to your account.');
  });

  it('Sign In stays tappable; an empty form explains what is missing instead of doing nothing', async () => {
    const { fixture, el, q } = render();
    const button = q<HTMLButtonElement>('button[type=submit]');
    expect(button.disabled).toBeFalse();
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(auth.login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter a valid email address.');
    expect(el.textContent).toContain('Password must be at least 8 characters.');
  });

  it('shows an email error under the field after an invalid entry', () => {
    const { el, type } = render();
    type('email', 'not-an-email');
    expect(el.textContent).toContain('Enter a valid email address.');
  });

  it('toggles the password between hidden and visible', () => {
    const { fixture, q } = render();
    const eye = q<HTMLButtonElement>('button[aria-pressed]');
    expect(q<HTMLInputElement>('#password').type).toBe('password');
    eye.click();
    fixture.detectChanges();
    expect(q<HTMLInputElement>('#password').type).toBe('text');
    expect(eye.getAttribute('aria-label')).toBe('Hide password');
  });

  it('signs in and opens Home', async () => {
    auth.login.and.resolveTo(true);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const { fixture, q, type } = render();
    type('email', 'client@example.com');
    type('password', 'longenough');
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(auth.login).toHaveBeenCalledWith('client@example.com', 'longenough');
    expect(navigate).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
  });

  it("shows the server's reason when sign-in fails", async () => {
    auth.login.and.rejectWith({ error: { message: 'Invalid email or password' } });
    const { fixture, el, q, type } = render();
    type('email', 'client@example.com');
    type('password', 'wrongpass1');
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Invalid email or password');
  });
});
