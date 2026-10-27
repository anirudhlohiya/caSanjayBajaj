import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import webpush from 'web-push';
import { DevicePlatform } from '../common/enums';
import { DeviceToken } from '../entities/device-token.entity';
import { User } from '../entities/user.entity';
import { NotificationsService } from './notifications.service';

jest.mock('web-push', () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() },
}));

const fcmSend = jest.fn();
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'fcm' })),
  cert: jest.fn((v: unknown) => v),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send: fcmSend }),
}));
jest.mock('node:fs', () => ({
  ...jest.requireActual<object>('node:fs'),
  readFileSync: jest.fn(() =>
    JSON.stringify({ project_id: 'p', client_email: 'e', private_key: 'k' }),
  ),
}));

const WEB_SUB = JSON.stringify({
  endpoint: 'https://push.example/1',
  keys: { p256dh: 'p', auth: 'a' },
});

const token = (id: string, platform: DevicePlatform, push_token: string) =>
  ({ id, user_id: 'u1', platform, push_token }) as DeviceToken;

describe('NotificationsService.pushToUser', () => {
  let tokens: DeviceToken[];
  let repo: { find: jest.Mock; delete: jest.Mock };

  const make = (firebasePath = '/secrets/firebase.json') => {
    const values: Record<string, string> = {
      'aws.accessKeyId': 'x',
      'aws.secretAccessKey': 'y',
      'firebase.vapidPublicKey': 'pub',
      'firebase.vapidPrivateKey': 'priv',
      'firebase.serviceAccountPath': firebasePath,
    };
    const config = {
      get: jest.fn((k: string) => values[k]),
      getOrThrow: jest.fn((k: string) => values[k]),
    } as unknown as ConfigService;
    return new NotificationsService(
      config,
      {} as Repository<User>,
      repo as unknown as Repository<DeviceToken>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tokens = [];
    repo = {
      find: jest.fn(() => Promise.resolve(tokens)),
      delete: jest.fn(() => Promise.resolve()),
    };
  });

  it('sends web push to browsers and FCM to the Android app', async () => {
    tokens = [
      token('t1', DevicePlatform.PWA, WEB_SUB),
      token('t2', DevicePlatform.ANDROID, 'fcm-token'),
    ];
    (webpush.sendNotification as jest.Mock).mockResolvedValue({});
    fcmSend.mockResolvedValue('msg-id');

    const ok = await make().pushToUser('u1', {
      title: 'Return filed',
      body: 'GSTR-3B filed',
      url: '/documents',
    });

    expect(ok).toBe(true);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(fcmSend).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'fcm-token',
        data: {
          title: 'Return filed',
          body: 'GSTR-3B filed',
          url: '/documents',
        },
      }),
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('removes devices that are gone (expired subscription, uninstalled app)', async () => {
    tokens = [
      token('web-gone', DevicePlatform.PWA, WEB_SUB),
      token('app-gone', DevicePlatform.ANDROID, 'old-token'),
    ];
    (webpush.sendNotification as jest.Mock).mockRejectedValue({
      statusCode: 410,
      message: 'Gone',
    });
    fcmSend.mockRejectedValue({
      code: 'messaging/registration-token-not-registered',
      message: 'unregistered',
    });

    const ok = await make().pushToUser('u1', { title: 't', body: 'b' });

    expect(ok).toBe(false);
    expect(repo.delete).toHaveBeenCalledWith(['web-gone', 'app-gone']);
  });

  it('skips the Android app quietly when Firebase is not configured', async () => {
    tokens = [token('t2', DevicePlatform.ANDROID, 'fcm-token')];
    const ok = await make('').pushToUser('u1', { title: 't', body: 'b' });
    expect(ok).toBe(false);
    expect(fcmSend).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
