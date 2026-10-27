import { Injectable, signal } from '@angular/core';
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

/** `window.NativePush`, injected by the Android app (see NativePushBridge.kt). */
interface NativePushBridge {
  available(): boolean;
  permission(): 'granted' | 'denied' | 'default';
  requestPermission(): void;
  requestToken(): void;
}

type NativeWindow = Window & {
  NativePush?: NativePushBridge;
  onNativePushPermission?: (state: string) => void;
  onNativePushToken?: (token: string) => void;
};

/** Device token registered for the signed-in user (native app). */
const NATIVE_TOKEN_KEY = 'fp_push_token';
/** The client answered (or dismissed) the post-login notification prompt. */
const PROMPTED_KEY = 'fp_push_prompted';

/**
 * Notifications on whichever channel the device supports:
 * - the Android app → native notifications via Firebase (`window.NativePush`);
 * - browsers / installed PWA → web push through the service worker.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private subscription: PushSubscription | null = null;

  /** Show the "Turn on notifications" sheet (Android app, first sign-in). */
  readonly showPrompt = signal(false);

  constructor(
    private readonly profile: ProfileService,
    private readonly router: Router,
  ) {}

  private get native(): NativePushBridge | null {
    const bridge = (window as NativeWindow).NativePush;
    try {
      return bridge?.available() ? bridge : null;
    } catch {
      return null;
    }
  }

  /** Running inside the Android app with notifications available. */
  isNative(): boolean {
    return this.native !== null;
  }

  /** Called by the shell once the user is signed in. */
  async init(): Promise<void> {
    const native = this.native;
    if (native) {
      if (native.permission() === 'granted') {
        await this.registerNativeToken();
      } else if (
        native.permission() === 'default' &&
        !localStorage.getItem(PROMPTED_KEY)
      ) {
        this.showPrompt.set(true);
      }
      return;
    }
    if (!this.webSupported()) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type === 'NOTIFY_NAVIGATE' && data.url) {
        this.router.navigateByUrl(data.url);
      }
    });

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const registration = await navigator.serviceWorker.ready;
    this.subscription = await registration.pushManager.getSubscription();
    if (this.subscription) {
      await this.syncSubscription(this.subscription);
    }
  }

  supported(): boolean {
    return this.isNative() || this.webSupported();
  }

  /** Notifications were explicitly blocked on this device. */
  blocked(): boolean {
    const native = this.native;
    if (native) return native.permission() === 'denied';
    return 'Notification' in window && Notification.permission === 'denied';
  }

  private webSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      !!APP.vapidPublicKey
    );
  }

  /** Answer from the post-login sheet. */
  async answerPrompt(allow: boolean): Promise<void> {
    localStorage.setItem(PROMPTED_KEY, '1');
    this.showPrompt.set(false);
    if (allow) await this.requestAndSubscribe();
  }

  async requestAndSubscribe(): Promise<boolean> {
    const native = this.native;
    if (native) {
      const state = await this.nativePermission(native);
      if (state !== 'granted') return false;
      return this.registerNativeToken();
    }
    if (!this.webSupported()) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        console.warn('Service worker not registered. Push is disabled.');
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      this.subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(APP.vapidPublicKey),
      });
      await this.syncSubscription(this.subscription);
      return true;
    } catch (e) {
      console.error('Push subscription failed:', e);
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    const native = this.native;
    if (native) {
      return native.permission() === 'granted' && !!localStorage.getItem(NATIVE_TOKEN_KEY);
    }
    if (!this.webSupported()) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const registration = await navigator.serviceWorker.ready;
    this.subscription = await registration.pushManager.getSubscription();
    return !!this.subscription;
  }

  async unsubscribe(): Promise<boolean> {
    if (this.native) {
      return this.releaseNativeToken();
    }
    if (!this.webSupported()) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
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

  /**
   * Sign-out: stop sending this account's alerts to this device. Must run
   * while the session is still valid. The next user who signs in here
   * registers the device for themselves.
   */
  async releaseDevice(): Promise<void> {
    try {
      if (this.native || localStorage.getItem(NATIVE_TOKEN_KEY)) {
        await this.releaseNativeToken();
        return;
      }
      if (!this.webSupported()) return;
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await this.profile.unregisterDeviceToken(JSON.stringify(sub));
    } catch {
      /* best effort: signing out must never fail because of this */
    }
  }

  // --- Android app (Firebase) ---------------------------------------------

  private nativePermission(native: NativePushBridge): Promise<string> {
    if (native.permission() === 'granted') return Promise.resolve('granted');
    return new Promise((resolve) => {
      const w = window as NativeWindow;
      w.onNativePushPermission = (state) => {
        w.onNativePushPermission = undefined;
        resolve(state);
      };
      native.requestPermission();
    });
  }

  private nativeToken(native: NativePushBridge): Promise<string> {
    return new Promise((resolve) => {
      const w = window as NativeWindow;
      const timer = setTimeout(() => resolve(''), 15000);
      w.onNativePushToken = (token) => {
        clearTimeout(timer);
        w.onNativePushToken = undefined;
        resolve(token);
      };
      native.requestToken();
    });
  }

  private async registerNativeToken(): Promise<boolean> {
    const native = this.native;
    if (!native) return false;
    const token = await this.nativeToken(native);
    if (!token) return false;
    try {
      await this.profile.registerDeviceToken(token, 'android');
      localStorage.setItem(NATIVE_TOKEN_KEY, token);
      return true;
    } catch {
      return false; /* retried on next app open */
    }
  }

  private async releaseNativeToken(): Promise<boolean> {
    const token = localStorage.getItem(NATIVE_TOKEN_KEY);
    localStorage.removeItem(NATIVE_TOKEN_KEY);
    if (!token) return false;
    try {
      await this.profile.unregisterDeviceToken(token);
    } catch {
      /* best effort */
    }
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
