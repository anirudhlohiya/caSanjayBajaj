import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User, WhatsappConversation, WhatsappMessage } from '../entities';
import { NotificationsService } from '../notifications/notifications.service';
import { WHATSAPP_TEMPLATE_DEFAULTS } from '../notifications/whatsapp-templates';
import { StorageService } from '../storage/storage.service';
import { WhatsappChatsService } from './whatsapp-chats.service';
import { WhatsappEventsService } from './whatsapp-events.service';

describe('WhatsappChatsService — templates & media', () => {
  let service: WhatsappChatsService;
  let conv: WhatsappConversation;
  const savedMessages: WhatsappMessage[] = [];

  const convRepo = {
    findOne: jest.fn(async () => conv),
    create: jest.fn((v: object) => v),
    save: jest.fn(async (v: WhatsappConversation) => Object.assign(conv, v)),
    update: jest.fn(),
  };
  const msgRepo = {
    create: jest.fn((v: object) => ({ id: 'm1', ...v })),
    save: jest.fn(async (v: WhatsappMessage) => {
      savedMessages.push(v);
      return v;
    }),
  };
  const userRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };
  const notifications = {
    sendWhatsappTemplate: jest.fn().mockResolvedValue(true),
    listApprovedTemplates: jest.fn().mockResolvedValue([
      {
        name: 'gst_filing_input_required',
        language: 'en',
        category: 'UTILITY',
        body: WHATSAPP_TEMPLATE_DEFAULTS.generalFollowup.body,
      },
    ]),
    templateDef: jest.fn((key: keyof typeof WHATSAPP_TEMPLATE_DEFAULTS) => ({
      key,
      ...WHATSAPP_TEMPLATE_DEFAULTS[key],
    })),
  };
  const events = { emit: jest.fn() };
  const storage = {
    createDownloadUrl: jest.fn(async (key: string) => `https://signed/${key}`),
  };

  beforeEach(() => {
    savedMessages.length = 0;
    conv = {
      id: 'c1',
      phoneNumber: '919876543210',
      status: 'ai_handling',
      clientId: 'u1',
    } as WhatsappConversation;
    service = new WhatsappChatsService(
      convRepo as unknown as Repository<WhatsappConversation>,
      msgRepo as unknown as Repository<WhatsappMessage>,
      userRepo as unknown as Repository<User>,
      notifications as unknown as NotificationsService,
      events as unknown as WhatsappEventsService,
      storage as unknown as StorageService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('starts a conversation with an approved template and hands it to staff', async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 'u1', phone: '9876543210' });

    const result = await service.startWithTemplate(
      { client_id: 'u1' },
      {
        template: 'gst_filing_input_required',
        params: ['Amit', 'GSTR-3B filing', 'October 2026'],
      },
      'admin1',
    );

    expect(notifications.sendWhatsappTemplate).toHaveBeenCalledWith(
      '9876543210',
      'gst_filing_input_required',
      'en',
      ['Amit', 'GSTR-3B filing', 'October 2026'],
      undefined,
    );
    expect(savedMessages[0]).toEqual(
      expect.objectContaining({
        direction: 'outbound',
        sender: 'staff',
        messageType: 'template',
        templateName: 'gst_filing_input_required',
        staffId: 'admin1',
        body: 'Hi Amit, we need a quick input from you to complete your GSTR-3B filing for October 2026. Please reply to this message so our team can finish it before the due date.',
      }),
    );
    expect(result.conversation.status).toBe('staff_takeover');
  });

  it('rejects unapproved templates and missing values', async () => {
    await expect(
      service.startWithTemplate(
        { phone: '9876543210' },
        { template: 'not_a_template', params: [] },
        'admin1',
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.startWithTemplate(
        { phone: '9876543210' },
        {
          template: 'gst_filing_input_required',
          params: ['Amit', 'GSTR-3B filing', ' '],
        },
        'admin1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(notifications.sendWhatsappTemplate).not.toHaveBeenCalled();
  });

  it('signs private S3 media keys but leaves absolute URLs alone', async () => {
    const signed = await service.withSignedMedia({
      mediaUrl: 'whatsapp-uploads/u1/2026-10/a.jpg',
    } as WhatsappMessage);
    expect(signed.mediaUrl).toBe(
      'https://signed/whatsapp-uploads/u1/2026-10/a.jpg',
    );

    const untouched = await service.withSignedMedia({
      mediaUrl: 'https://r2.example/a.jpg',
    } as WhatsappMessage);
    expect(untouched.mediaUrl).toBe('https://r2.example/a.jpg');
  });
});
