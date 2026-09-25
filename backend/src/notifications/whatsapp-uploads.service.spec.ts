import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { DocumentCategory, TaskStatus } from '../common/enums';
import {
  ComplianceTask,
  Document,
  GstFilingPeriod,
  User,
  WhatsappConversation,
} from '../entities';
import { WhatsappChatsService } from '../whatsapp-chats/whatsapp-chats.service';
import { NotificationsService } from './notifications.service';
import {
  UPLOAD_REPLY,
  WhatsappUploadsService,
} from './whatsapp-uploads.service';

describe('WhatsappUploadsService', () => {
  const user = { id: 'u1', name: 'Amit' } as User;
  let pending: WhatsappConversation['pendingUpload'];
  let service: WhatsappUploadsService;

  const notifications = {
    sendWhatsapp: jest.fn().mockResolvedValue(true),
    sendWhatsappButtons: jest.fn().mockResolvedValue(true),
    sendWhatsappInteractiveList: jest.fn().mockResolvedValue(true),
  };
  const chats = {
    findConversation: jest.fn(async () => ({
      id: 'c1',
      pendingUpload: pending,
    })),
    setPendingUpload: jest.fn(async (_id: string, p: typeof pending) => {
      pending = p;
    }),
    recordOutboundAiMessage: jest.fn().mockResolvedValue({}),
    setStatus: jest.fn().mockResolvedValue({}),
    updateConversation: jest.fn().mockResolvedValue({}),
  };
  const docRepo = { update: jest.fn().mockResolvedValue({}) };
  const taskRow = { status: TaskStatus.PENDING } as ComplianceTask;
  const taskRepo = {
    findOne: jest.fn().mockResolvedValue(taskRow),
    save: jest.fn((t: ComplianceTask) => Promise.resolve(t)),
  };
  const periods = [
    { id: 'p-oct', period_label: 'October 2026' },
    { id: 'p-sep', period_label: 'September 2026' },
  ] as GstFilingPeriod[];
  const periodRepo = {
    find: jest.fn().mockResolvedValue(periods),
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        periods.find((p) => p.id === where.id) ?? null,
    ),
  };

  const conv = () =>
    ({
      id: 'c1',
      pendingUpload: pending,
      internalNotes: null,
    }) as WhatsappConversation;

  beforeEach(() => {
    jest.useFakeTimers();
    pending = null;
    service = new WhatsappUploadsService(
      { get: jest.fn().mockReturnValue(20) } as unknown as ConfigService,
      notifications as unknown as NotificationsService,
      chats as unknown as WhatsappChatsService,
      docRepo as unknown as Repository<Document>,
      taskRepo as unknown as Repository<ComplianceTask>,
      periodRepo as unknown as Repository<GstFilingPeriod>,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('batches several files into ONE question after the quiet gap', async () => {
    service.addFile('c1', user, 'd1', '9198', 'pn');
    service.addFile('c1', user, 'd2', '9198', 'pn');
    service.addFile('c1', user, 'd3', '9198', 'pn');
    expect(notifications.sendWhatsappButtons).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(20_000);

    expect(notifications.sendWhatsappButtons).toHaveBeenCalledTimes(1);
    expect(notifications.sendWhatsappButtons).toHaveBeenCalledWith(
      '9198',
      'Got 3 files 👍 What are these files for?',
      [
        { id: UPLOAD_REPLY.gst, title: 'GST documents' },
        { id: UPLOAD_REPLY.itr, title: 'ITR documents' },
        { id: UPLOAD_REPLY.other, title: 'Something else' },
      ],
      'pn',
    );
    expect(pending).toEqual(
      expect.objectContaining({
        documentIds: ['d1', 'd2', 'd3'],
        step: 'ask_type',
      }),
    );
  });

  it('GST → asks the month, then files the batch and advances the task', async () => {
    pending = {
      documentIds: ['d1', 'd2'],
      step: 'ask_type',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    expect(
      await service.handleAnswer(conv(), user, '9198', UPLOAD_REPLY.gst),
    ).toBe(true);
    expect(notifications.sendWhatsappInteractiveList).toHaveBeenCalled();
    expect(pending?.step).toBe('ask_period');

    expect(
      await service.handleAnswer(
        conv(),
        user,
        '9198',
        `${UPLOAD_REPLY.periodPrefix}p-oct`,
      ),
    ).toBe(true);
    expect(docRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1' }),
      { category: DocumentCategory.GST, filing_period_id: 'p-oct' },
    );
    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: TaskStatus.UPLOADED }),
    );
    expect(pending).toBeNull();
    expect(notifications.sendWhatsapp).toHaveBeenCalledWith(
      '9198',
      expect.stringContaining('*October 2026*'),
      undefined,
    );
  });

  it('ITR → files under the current assessment year', async () => {
    pending = {
      documentIds: ['d1'],
      step: 'ask_type',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    expect(await service.handleAnswer(conv(), user, '9198', 'ITR')).toBe(true);
    expect(docRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ category: DocumentCategory.ITR }),
    );
  });

  it('Something else → escalates to staff', async () => {
    pending = {
      documentIds: ['d1'],
      step: 'ask_type',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    expect(
      await service.handleAnswer(conv(), user, '9198', UPLOAD_REPLY.other),
    ).toBe(true);
    expect(chats.setStatus).toHaveBeenCalledWith('c1', 'escalated');
  });

  it('does not consume unrelated messages or expired questions', async () => {
    pending = {
      documentIds: ['d1'],
      step: 'ask_type',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(
      await service.handleAnswer(conv(), user, '9198', 'what is my due?'),
    ).toBe(false);

    pending = { ...pending, expiresAt: new Date(Date.now() - 1).toISOString() };
    expect(await service.handleAnswer(conv(), user, '9198', 'gst')).toBe(false);
  });
});
