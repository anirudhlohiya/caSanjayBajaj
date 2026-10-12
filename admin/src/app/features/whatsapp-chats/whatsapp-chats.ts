import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WhatsappChatsService,
} from '../../core/services/feature.services';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  WhatsappConversation,
  WhatsappConversationStatus,
  WhatsappMessage,
  WhatsappUsageStats,
} from '../../core/models';
import { Spinner } from '../../shared/components/spinner';

@Component({
  selector: 'app-whatsapp-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-chats.html',
})
export class WhatsappChatsPage implements OnInit {
  private readonly chatsService = inject(WhatsappChatsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  // Data signals
  readonly conversations = signal<WhatsappConversation[]>([]);
  readonly selectedConversation = signal<WhatsappConversation | null>(null);
  readonly messages = signal<WhatsappMessage[]>([]);
  readonly usage = signal<WhatsappUsageStats | null>(null);

  // UI state signals
  readonly loadingConversations = signal<boolean>(true);
  readonly loadingMessages = signal<boolean>(false);
  readonly sending = signal<boolean>(false);
  readonly savingMetadata = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly activeTab = signal<string>('all');
  readonly replyText = signal<string>('');
  readonly mobileView = signal<'list' | 'chat'>('list');
  readonly showDetailsDrawer = signal<boolean>(false);

  // Editable metadata signals
  readonly clientNameEdit = signal<string>('');
  readonly businessNameEdit = signal<string>('');
  readonly gstinEdit = signal<string>('');
  readonly verifiedEdit = signal<boolean>(false);
  readonly internalNotesEdit = signal<string>('');

  private eventSource: EventSource | null = null;

  // Filtered conversations
  readonly filteredConversations = computed(() => {
    const list = this.conversations();
    const query = this.searchQuery().trim().toLowerCase();
    const tab = this.activeTab();

    return list.filter((c) => {
      // Tab filter
      if (tab === 'needs_attention') {
        if (c.status !== 'staff_takeover' && c.status !== 'escalated') return false;
      } else if (tab === 'ai_handling') {
        if (c.status !== 'ai_handling') return false;
      } else if (tab === 'staff_takeover') {
        if (c.status !== 'staff_takeover') return false;
      } else if (tab === 'escalated') {
        if (c.status !== 'escalated') return false;
      } else if (tab === 'closed') {
        if (c.status !== 'closed') return false;
      }

      // Search filter
      if (!query) return true;
      const phoneMatch = c.phoneNumber?.toLowerCase().includes(query);
      const nameMatch = c.clientName?.toLowerCase().includes(query);
      const bizMatch = c.businessName?.toLowerCase().includes(query);
      const gstinMatch = c.gstin?.toLowerCase().includes(query);
      const lastMsgMatch = c.lastMessage?.body?.toLowerCase().includes(query);

      return phoneMatch || nameMatch || bizMatch || gstinMatch || lastMsgMatch;
    });
  });

  // 24-hour service window calculation
  readonly windowStatus = computed(() => {
    const msgs = this.messages();
    if (!msgs || msgs.length === 0) {
      return { isActive: true, remainingHours: 24 };
    }

    // Find latest inbound message
    const inbounds = msgs.filter((m) => m.direction === 'inbound');
    if (inbounds.length === 0) {
      return { isActive: true, remainingHours: 24 };
    }

    const latest = inbounds[inbounds.length - 1];
    const diffMs = Date.now() - new Date(latest.createdAt).getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const remainingMs = twentyFourHoursMs - diffMs;

    if (remainingMs <= 0) {
      return { isActive: false, remainingHours: 0 };
    }

    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return { isActive: true, remainingHours };
  });

  ngOnInit(): void {
    void this.loadConversations();
    void this.loadUsage();
    this.setupSse();

    this.destroyRef.onDestroy(() => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    });
  }

  async loadConversations(): Promise<void> {
    this.loadingConversations.set(true);
    try {
      const res = await this.chatsService.listConversations({
        limit: 50,
      });
      this.conversations.set(res.items);

      // If current selection exists, update reference
      const cur = this.selectedConversation();
      if (cur) {
        const updated = res.items.find((i) => i.id === cur.id);
        if (updated) {
          this.selectedConversation.set(updated);
        }
      } else if (res.items.length > 0) {
        // Auto-select first conversation
        void this.selectConversation(res.items[0]);
      }
    } catch {
      this.toast.error('Failed to load WhatsApp conversations');
    } finally {
      this.loadingConversations.set(false);
    }
  }

  async loadUsage(): Promise<void> {
    try {
      const stats = await this.chatsService.getUsage();
      this.usage.set(stats);
    } catch {
      // Usage endpoint non-blocking
    }
  }

  async selectConversation(conv: WhatsappConversation): Promise<void> {
    this.selectedConversation.set(conv);
    this.mobileView.set('chat');
    this.clientNameEdit.set(conv.clientName || '');
    this.businessNameEdit.set(conv.businessName || '');
    this.gstinEdit.set(conv.gstin || '');
    this.verifiedEdit.set(conv.verified || false);
    this.internalNotesEdit.set(conv.internalNotes || '');

    // Load message thread
    this.loadingMessages.set(true);
    try {
      const msgs = await this.chatsService.getMessages(conv.id);
      this.messages.set(msgs);
      this.scrollToBottom();

      // Mark as read if has unread count
      if (conv.unreadCount > 0) {
        await this.chatsService.markAsRead(conv.id);
        this.conversations.update((list) =>
          list.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
        );
      }
    } catch {
      this.toast.error('Failed to load conversation messages');
    } finally {
      this.loadingMessages.set(false);
    }
  }

  async sendMessage(): Promise<void> {
    const conv = this.selectedConversation();
    const text = this.replyText().trim();
    if (!conv || !text || this.sending()) return;

    if (!this.windowStatus().isActive) {
      this.toast.error(
        'The 24-hour WhatsApp service window has expired. The client must message first or a template must be sent.',
      );
      return;
    }

    this.sending.set(true);
    try {
      // If still under AI handling, take over automatically
      if (conv.status === 'ai_handling') {
        await this.chatsService.takeover(conv.id);
        this.selectedConversation.update((c) =>
          c ? { ...c, status: 'staff_takeover' } : null,
        );
      }

      const newMsg = await this.chatsService.sendStaffMessage(conv.id, text);
      this.messages.update((msgs) => [...msgs, newMsg]);
      this.replyText.set('');
      this.scrollToBottom();
      this.toast.success('Message sent via WhatsApp');
      void this.loadUsage();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to send message';
      this.toast.error(msg);
    } finally {
      this.sending.set(false);
    }
  }

  async takeover(): Promise<void> {
    const conv = this.selectedConversation();
    if (!conv) return;
    try {
      const updated = await this.chatsService.takeover(conv.id);
      this.selectedConversation.set(updated);
      this.conversations.update((list) =>
        list.map((c) => (c.id === conv.id ? { ...c, status: 'staff_takeover' } : c)),
      );
      this.toast.success('Conversation switched to Staff Takeover. AI replies paused.');
    } catch {
      this.toast.error('Failed to take over conversation');
    }
  }

  async release(): Promise<void> {
    const conv = this.selectedConversation();
    if (!conv) return;
    try {
      const updated = await this.chatsService.release(conv.id);
      this.selectedConversation.set(updated);
      this.conversations.update((list) =>
        list.map((c) => (c.id === conv.id ? { ...c, status: 'ai_handling' } : c)),
      );
      this.toast.success('Handed back to AI. AI will answer future client messages.');
    } catch {
      this.toast.error('Failed to hand back conversation to AI');
    }
  }

  async changeStatus(status: WhatsappConversationStatus): Promise<void> {
    const conv = this.selectedConversation();
    if (!conv) return;
    try {
      let updated: WhatsappConversation;
      if (status === 'escalated') {
        updated = await this.chatsService.escalate(conv.id);
      } else if (status === 'closed') {
        updated = await this.chatsService.close(conv.id);
      } else if (status === 'staff_takeover') {
        updated = await this.chatsService.takeover(conv.id);
      } else {
        updated = await this.chatsService.release(conv.id);
      }
      this.selectedConversation.set(updated);
      this.conversations.update((list) =>
        list.map((c) => (c.id === conv.id ? { ...c, status } : c)),
      );
      this.toast.success(`Conversation status updated to ${status}`);
    } catch {
      this.toast.error('Failed to update status');
    }
  }

  async saveMetadata(): Promise<void> {
    const conv = this.selectedConversation();
    if (!conv || this.savingMetadata()) return;

    this.savingMetadata.set(true);
    try {
      const updated = await this.chatsService.updateMetadata(conv.id, {
        clientName: this.clientNameEdit().trim() || undefined,
        businessName: this.businessNameEdit().trim() || undefined,
        gstin: this.gstinEdit().trim() || undefined,
        verified: this.verifiedEdit(),
        internalNotes: this.internalNotesEdit().trim(),
      });
      this.selectedConversation.set(updated);
      this.conversations.update((list) =>
        list.map((c) => (c.id === conv.id ? updated : c)),
      );
      this.toast.success('Client metadata saved');
    } catch {
      this.toast.error('Failed to save client metadata');
    } finally {
      this.savingMetadata.set(false);
    }
  }

  private setupSse(): void {
    const token = this.auth.access;
    const url = this.chatsService.getStreamUrl(token || undefined);

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type: string;
            conversationId?: string;
            data?: WhatsappMessage;
          };

          if (payload.type === 'message' && payload.data) {
            const newMsg = payload.data;
            const cur = this.selectedConversation();

            // If incoming message belongs to currently open thread
            if (cur && cur.id === payload.conversationId) {
              this.messages.update((msgs) => {
                const exists = msgs.some((m) => m.id === newMsg.id);
                return exists ? msgs : [...msgs, newMsg];
              });
              this.scrollToBottom();
            }

            // Refresh conversation list preview
            void this.refreshConversationListItem(payload.conversationId);
          } else if (payload.type === 'conversation') {
            void this.loadConversations();
          }
        } catch {
          // SSE parse error
        }
      };

      this.eventSource.onerror = () => {
        // Will auto reconnect
      };
    } catch {
      // SSE unsupported or network error
    }
  }

  private async refreshConversationListItem(convId?: string): Promise<void> {
    if (!convId) return;
    try {
      const res = await this.chatsService.listConversations({ limit: 50 });
      this.conversations.set(res.items);
      const cur = this.selectedConversation();
      if (cur && cur.id === convId) {
        const found = res.items.find((i) => i.id === convId);
        if (found) this.selectedConversation.set(found);
      }
    } catch {
      // non-blocking
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }

  fmtTime(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  fmtDateTime(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getStatusClass(status: WhatsappConversationStatus): string {
    switch (status) {
      case 'ai_handling':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'staff_takeover':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'escalated':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'closed':
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  }

  getStatusLabel(status: WhatsappConversationStatus): string {
    switch (status) {
      case 'ai_handling':
        return 'AI Handling';
      case 'staff_takeover':
        return 'Staff Takeover';
      case 'escalated':
        return 'Escalated';
      case 'closed':
        return 'Closed';
    }
  }
}
