import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.html',
})
export class Services {
  private readonly toast = inject(ToastService);
  searchQuery = '';

  onServiceClick() {
    this.toast.show('This feature is coming soon...', 'info');
  }
}
