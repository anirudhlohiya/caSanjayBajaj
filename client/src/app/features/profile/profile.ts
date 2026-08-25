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
import { ProfileService } from '../../core/services/feature.services';

const PHOTO_KEY = 'fp_profile_photo';

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
  readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);

  readonly savingPhone = signal(false);
  readonly photoUrl = signal<string | null>(localStorage.getItem(PHOTO_KEY));

  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  readonly phoneForm = this.fb.nonNullable.group({
    phone: ['', [Validators.pattern(/^[0-9+\-\s]{10,20}$/)]],
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.loadProfile();
    } catch {
      /* auth guard handles redirect */
    }
    const profile = this.auth.userProfile();
    if (profile?.phone) {
      this.phoneForm.controls.phone.setValue(profile.phone);
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