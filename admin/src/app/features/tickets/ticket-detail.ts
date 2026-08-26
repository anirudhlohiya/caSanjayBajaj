import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TicketsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Ticket, TicketMessage } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Spinner } from '../../shared/components/spinner';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-detail.html',
})
export class TicketDetailPage implements OnInit {
  private readonly ticketsService = inject(TicketsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly ticket = signal<Ticket | null>(null);
  readonly sending = signal(false);

  readonly replyForm = this.fb.nonNullable.group({
    message: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) void this.load(id);
    });
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      this.ticket.set(await this.ticketsService.get(id));
    } finally {
      this.loading.set(false);
    }
  }

  async sendReply(): Promise<void> {
    if (this.replyForm.invalid || !this.ticket()) return;
    this.sending.set(true);
    try {
      const msg = this.replyForm.controls.message.value;
      await this.ticketsService.reply(this.ticket()!.id, msg);
      this.replyForm.reset();
      this.toast.success('Reply sent');
      await this.load(this.ticket()!.id);
    } finally {
      this.sending.set(false);
    }
  }

  async changeStatus(status: string): Promise<void> {
    if (!this.ticket()) return;
    await this.ticketsService.updateStatus(this.ticket()!.id, status);
    this.toast.success(`Ticket marked as ${status}`);
    await this.load(this.ticket()!.id);
  }

  goBack(): void {
    void this.router.navigate(['/tickets']);
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  isOwnMessage(msg: TicketMessage): boolean {
    return msg.sender_type === 'admin';
  }
}
