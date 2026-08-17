import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly counter = new BehaviorSubject(0);
  readonly toasts = new BehaviorSubject<Toast[]>([]);

  private nextId(): number {
    const id = this.counter.value + 1;
    this.counter.next(id);
    return id;
  }

  show(message: string, type: ToastType = 'info', timeout = 4000) {
    const id = this.nextId();
    const toasts = this.toasts.value;
    this.toasts.next([...toasts, { id, type, message }]);
    if (timeout > 0) {
      setTimeout(() => this.dismiss(id), timeout);
    }
  }

  success(message: string) {
    this.show(message, 'success');
  }

  error(message: string) {
    this.show(message, 'error', 6000);
  }

  dismiss(id: number) {
    this.toasts.next(this.toasts.value.filter((t) => t.id !== id));
  }
}
