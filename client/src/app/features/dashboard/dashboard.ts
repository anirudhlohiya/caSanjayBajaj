import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

import { Spinner } from '../../shared/components/spinner';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  readonly router = inject(Router);

  readonly loading = signal(false);

  firstName(): string {
    const name = this.auth.userProfile()?.name;
    return name?.split(' ')[0] ?? 'there';
  }
}