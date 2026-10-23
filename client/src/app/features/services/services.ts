import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ServicesOfferedService } from '../../core/services/feature.services';
import { Service } from '../../core/models';
import { serviceTileClass } from '../../core/service-palette';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [FormsModule, RouterLink, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.html',
})
export class Services {
  private readonly servicesService = inject(ServicesOfferedService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly services = signal<Service[]>([]);
  readonly searchQuery = signal('');

  readonly filteredServices = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.services();
    return this.services().filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some((t) => t.toLowerCase().includes(query)),
    );
  });

  readonly tileClass = serviceTileClass;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.services.set(await this.servicesService.listActive());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
