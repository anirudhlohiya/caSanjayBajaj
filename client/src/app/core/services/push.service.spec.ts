import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PushService } from './push.service';
import { ProfileService } from './feature.services';

type W = Window & {
  NativePush?: unknown;
  onNativePushPermission?: (s: string) => void;
  onNativePushToken?: (t: string) => void;
};

describe('PushService (Android app)', () => {
  let push: PushService;
  let profile: jasmine.SpyObj<ProfileService>;
  let permission: 'granted' | 'denied' | 'default';

  beforeEach(() => {
    localStorage.removeItem('fp_push_token');
    localStorage.removeItem('fp_push_prompted');
    permission = 'default';
    // Fake bridge: answers asynchronously, like the real Android one
    (window as W).NativePush = {
      available: () => true,
      permission: () => permission,
      requestPermission: () =>
        setTimeout(() => {
          permission = 'granted';
          (window as W).onNativePushPermission?.('granted');
        }),
      requestToken: () => setTimeout(() => (window as W).onNativePushToken?.('fcm-123')),
    };
    profile = jasmine.createSpyObj<ProfileService>('ProfileService', [
      'registerDeviceToken',
      'unregisterDeviceToken',
    ]);
    profile.registerDeviceToken.and.resolveTo({});
    profile.unregisterDeviceToken.and.resolveTo({});
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ProfileService, useValue: profile }],
    });
    push = TestBed.inject(PushService);
  });

  afterEach(() => {
    delete (window as W).NativePush;
    localStorage.removeItem('fp_push_token');
    localStorage.removeItem('fp_push_prompted');
  });

  it('asks once after the first sign-in', async () => {
    await push.init();
    expect(push.showPrompt()).toBeTrue();

    await push.answerPrompt(false);
    expect(push.showPrompt()).toBeFalse();

    await push.init();
    expect(push.showPrompt()).toBeFalse(); // not asked again
  });

  it('turning on: permission, then the device token is registered as android', async () => {
    await push.init();
    await push.answerPrompt(true);
    expect(profile.registerDeviceToken).toHaveBeenCalledWith('fcm-123', 'android');
    expect(await push.isSubscribed()).toBeTrue();
  });

  it('re-registers on every app open once allowed (token may have rotated)', async () => {
    permission = 'granted';
    await push.init();
    expect(profile.registerDeviceToken).toHaveBeenCalledWith('fcm-123', 'android');
    expect(push.showPrompt()).toBeFalse();
  });

  it('signing out removes this phone from the account', async () => {
    permission = 'granted';
    await push.init();
    await push.releaseDevice();
    expect(profile.unregisterDeviceToken).toHaveBeenCalledWith('fcm-123');
    expect(localStorage.getItem('fp_push_token')).toBeNull();
  });
});
