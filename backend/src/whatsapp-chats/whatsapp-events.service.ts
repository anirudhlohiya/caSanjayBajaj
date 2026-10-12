import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface WhatsappStreamEvent {
  type: 'message' | 'conversation';
  conversationId?: string;
  data?: unknown;
}

@Injectable()
export class WhatsappEventsService {
  private readonly events$ = new Subject<WhatsappStreamEvent>();

  emit(event: WhatsappStreamEvent): void {
    this.events$.next(event);
  }

  getStream(): Observable<WhatsappStreamEvent> {
    return this.events$.asObservable();
  }
}
