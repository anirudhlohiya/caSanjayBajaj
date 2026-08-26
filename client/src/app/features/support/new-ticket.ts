import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TicketsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { TICKET_CATEGORY_LABELS } from '../../core/models';

@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-ticket.html',
})
export class NewTicket {
  private readonly ticketsService = inject(TicketsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly saving = signal(false);
  readonly error = signal('');

  readonly categories = Object.entries(TICKET_CATEGORY_LABELS);

  readonly form = this.fb.nonNullable.group({
    subject: ['', [Validators.required, Validators.maxLength(255)]],
    category: ['general'],
    priority: ['medium'],
    message: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.error.set('');
    this.saving.set(true);
    try {
      const f = this.form.getRawValue();
      const ticket = await this.ticketsService.create({
        subject: f.subject,
        category: f.category,
        priority: f.priority,
        message: f.message,
      });
      this.toast.success('Ticket created');
      await this.router.navigate(['/support', ticket.id]);
    } catch (err) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ??
          'Failed to create ticket. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
