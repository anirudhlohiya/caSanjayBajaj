import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { APP } from '../models';
import { ProfileService } from './feature.services';

export function urlBase64ToUint8Array(
  base64String: string,
): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

@Injectable({ providedIn: 'root' })
export class PushService {
  private subscription: PushSubscription | null = null;

  constructor(
    private readonly profile: ProfileService,
    private readonly router: Router,
  ) {}

  async init(): Promise<void> {
    if (!this.supported()) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type === 'NOTIFY_NAVIGATE' && data.url) {
        this.router.navigateByUrl(data.url);
      }
    });

    const registration = await navigator.serviceWorker.ready;
    this.subscription = await registration.pushManager.getSubscription();
    if (this.subscription) {
      await this.syncSubscription(this.subscription);
    }
  }

  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      !!APP.vapidPublicKey
    );
  }

  async requestAndSubscribe(): Promise<boolean> {
    if (!this.supported()) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    this.subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(APP.vapidPublicKey),
    });
    await this.syncSubscription(this.subscription);
    return true;
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.supported()) return false;
    const registration = await navigator.serviceWorker.ready;
    this.subscription = await registration.pushManager.getSubscription();
    return !!this.subscription;
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.supported()) return false;
    const registration = await navigator.serviceWorker.ready;
    this.subscription = await registration.pushManager.getSubscription();
    if (!this.subscription) return false;
    try {
      await this.profile.unregisterDeviceToken(
        JSON.stringify(this.subscription),
      );
    } catch {
      /* best effort */
    }
    await this.subscription.unsubscribe();
    this.subscription = null;
    return true;
  }

  private async syncSubscription(subscription: PushSubscription): Promise<void> {
    try {
      await this.profile.registerDeviceToken(
        JSON.stringify(subscription),
        'pwa',
      );
    } catch {
      /* backend may be unreachable; retry on next init */
    }
  }
}
