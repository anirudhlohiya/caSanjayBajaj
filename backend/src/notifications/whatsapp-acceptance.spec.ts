import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsappKnowledgeBaseService } from './whatsapp-knowledge-base.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappMediaService } from './whatsapp-media.service';
import { WhatsappTranscriptionService } from './whatsapp-transcription.service';
import { WhatsappUploadsService } from './whatsapp-uploads.service';
import { NotificationsService } from './notifications.service';
import { StorageService } from '../storage/storage.service';
import { WhatsappChatsService } from '../whatsapp-chats/whatsapp-chats.service';
import {
  User,
  ClientCertificate,
  ItrReturn,
  Report,
  ComplianceTask,
  Document,
  GstFilingPeriod,
} from '../entities';
import {
  ComplianceCategory,
  TaskStatus,
  UserType,
  CertType,
} from '../common/enums';

describe('WhatsApp Agent Acceptance Tests (11-Section KB, Human Voice, Scoped DB, Security)', () => {
  let kbService: WhatsappKnowledgeBaseService;
  let aiService: WhatsappAiService;
  let controller: WhatsappWebhookController;

  // Mock repositories and services
  const mockRegisteredUser: User = {
    id: 'f4fd4030-c91e-4cf7-917a-05eedf44d4a0',
    name: 'Anirudh Lohiya',
    email: 'anirudhlohiya999@gmail.com',
    phone: '9316527283',
    gstin: '08AAAAA0000A1Z5',
    business_name: 'Lohiya Enterprises',
    user_type: UserType.GST,
  } as unknown as User;

  const mockTaskRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockCertRepo = {
    findOne: jest.fn(),
  };

  const mockItrRepo = {
    findOne: jest.fn(),
  };

  const mockReportRepo = {
    findOne: jest.fn(),
  };

  const mockDocRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest
      .fn()
      .mockImplementation(async (doc) => ({ id: 'mock-doc-id', ...doc })),
  };

  const mockPeriodRepo = {
    findOne: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const sentMessages: Array<{
    to: string;
    text?: string;
    caption?: string;
    fileUrl?: string;
  }> = [];

  const mockNotificationsService = {
    sendWhatsapp: jest.fn().mockImplementation(async (to, text) => {
      sentMessages.push({ to, text });
      return true;
    }),
    sendWhatsappDocument: jest
      .fn()
      .mockImplementation(async (to, fileUrl, filename, caption) => {
        sentMessages.push({ to, fileUrl, text: caption, caption });
        return true;
      }),
    sendWhatsappInteractiveList: jest
      .fn()
      .mockImplementation(async (to, title, body) => {
        sentMessages.push({ to, text: `[Interactive List] ${body}` });
        return true;
      }),
  };

  const mockStorageService = {
    createAttachmentDownloadUrl: jest
      .fn()
      .mockResolvedValue('https://s3.mock.aws/download/cert.pdf'),
  };

  const mockMediaService = {
    processAndStoreMedia: jest.fn().mockResolvedValue({
      s3Key:
        'whatsapp-uploads/f4fd4030-c91e-4cf7-917a-05eedf44d4a0/2026-10/invoice_01.jpg',
      publicUrl: 'https://s3.mock.aws/whatsapp-uploads/invoice_01.jpg',
      filename: 'invoice_01.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      buffer: Buffer.from('fake-bytes'),
    }),
  };

  const mockTranscriptionService = {
    transcribe: jest.fn().mockResolvedValue(null),
  };

  const mockUploadsService = {
    addFile: jest.fn(),
    handleAnswer: jest.fn().mockResolvedValue(false),
  };

  let mockConversation: any = {
    id: 'conv-uuid-123',
    phoneNumber: '919316527283',
    status: 'ai_handling',
    unreadCount: 0,
    internalNotes: '',
    client: mockRegisteredUser,
  };

  const mockChatsService = {
    findMatchingUserByPhone: jest
      .fn()
      .mockImplementation(async (phone: string) => {
        const clean = phone.replace(/\D/g, '');
        if (clean.endsWith('9316527283')) return mockRegisteredUser;
        return null;
      }),
    recordInboundMessage: jest.fn().mockImplementation(async () => ({
      conversation: mockConversation,
      message: { id: 'msg-1' },
      isDuplicate: false,
    })),
    recordOutboundAiMessage: jest
      .fn()
      .mockImplementation(async (convId, text) => {
        return { id: 'msg-out-1', text };
      }),
    updateConversation: jest.fn().mockImplementation(async (id, dto) => {
      Object.assign(mockConversation, dto);
      return mockConversation;
    }),
    setStatus: jest.fn().mockImplementation(async (id, status) => {
      mockConversation.status = status;
      return mockConversation;
    }),
    takeover: jest.fn().mockImplementation(async (id, staffId) => {
      mockConversation.status = 'staff_takeover';
      mockConversation.assignedStaffId = staffId;
      return mockConversation;
    }),
    getMessages: jest.fn().mockResolvedValue([]),
    updateMessageBody: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappWebhookController],
      providers: [
        WhatsappKnowledgeBaseService,
        WhatsappAiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'GROQ_API_KEY') return 'gsk_test_groq_key';
              if (key === 'GROQ_MODEL') return 'llama-3.3-70b-versatile';
              if (key === 'WHATSAPP_PHONE_NUMBER_ID') return '1332098229994767';
              return null;
            }),
          },
        },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: WhatsappMediaService, useValue: mockMediaService },
        {
          provide: WhatsappTranscriptionService,
          useValue: mockTranscriptionService,
        },
        { provide: WhatsappUploadsService, useValue: mockUploadsService },
        { provide: WhatsappChatsService, useValue: mockChatsService },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-signed-jwt-token'),
          },
        },
        {
          provide: getRepositoryToken(ClientCertificate),
          useValue: mockCertRepo,
        },
        { provide: getRepositoryToken(ItrReturn), useValue: mockItrRepo },
        { provide: getRepositoryToken(Report), useValue: mockReportRepo },
        { provide: getRepositoryToken(ComplianceTask), useValue: mockTaskRepo },
        { provide: getRepositoryToken(Document), useValue: mockDocRepo },
        {
          provide: getRepositoryToken(GstFilingPeriod),
          useValue: mockPeriodRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    kbService = moduleRef.get<WhatsappKnowledgeBaseService>(
      WhatsappKnowledgeBaseService,
    );
    aiService = moduleRef.get<WhatsappAiService>(WhatsappAiService);
    controller = moduleRef.get<WhatsappWebhookController>(
      WhatsappWebhookController,
    );
  });

  beforeEach(() => {
    sentMessages.length = 0;
    mockConversation = {
      id: 'conv-uuid-123',
      phoneNumber: '919316527283',
      status: 'ai_handling',
      unreadCount: 0,
      internalNotes: '',
      client: mockRegisteredUser,
    };
    mockTaskRepo.find.mockResolvedValue([]);
    mockTaskRepo.findOne.mockResolvedValue(null);
    jest.clearAllMocks();
  });

  describe('Knowledge Base Structure & 11 Sections', () => {
    it('should have all 11 required interview sections loaded', () => {
      const data = kbService.getRawData();
      expect(data).toBeDefined();
      expect(data?.sections).toBeDefined();

      const requiredSections = [
        '1_services',
        '2_fees',
        '3_deadlines',
        '4_document_rules',
        '5_verification_protocol',
        '6_reminder_policy',
        '7_persona_tone',
        '8_disclaimers',
        '9_urgency_triage',
        '10_onboarding',
        '11_office_info',
      ];

      for (const secKey of requiredSections) {
        expect(data!.sections[secKey]).toBeDefined();
        expect(data!.sections[secKey].title).toBeDefined();
        expect(
          data!.sections[secKey].client_interview_placeholder,
        ).toBeDefined();
      }
    });

    it('should generate formatted prompt context without error', () => {
      const promptContext = kbService.getKnowledgeBasePromptContext();
      expect(promptContext).toContain('PRACTICE SERVICES & SCOPE');
      expect(promptContext).toContain('STATUTORY DEADLINES & FILING CALENDAR');
    });
  });

  describe('ACCEPTANCE TEST 1: FAQ question → short, human, KB-based reply (≤3 sentences, no banned phrases)', () => {
    it('should clean and enforce brevity rules on AI output', () => {
      const rawAiText =
        'Certainly! Great question. For monthly GSTR-1, you should submit your sales invoices by the 7th of every month. I hope this helps! Please don’t hesitate to contact us. Best regards.';

      // Call internal postProcessReply
      const processed = (aiService as any).postProcessReply(rawAiText);

      // Banned phrases must NOT be present
      expect(processed).not.toMatch(/certainly/i);
      expect(processed).not.toMatch(/great question/i);
      expect(processed).not.toMatch(/i hope this helps/i);
      expect(processed).not.toMatch(/please don't hesitate/i);
      expect(processed).not.toMatch(/best regards/i);

      // Max 2-3 sentences
      const sentences = processed
        .split(/[.!?]+/)
        .filter((s: string) => s.trim().length > 0);
      expect(sentences.length).toBeLessThanOrEqual(3);
    });
  });

  describe('ACCEPTANCE TEST 2: "How much do I owe?" from registered test client → exact figure from DB', () => {
    it('should look up exact amount from compliance_tasks table and return exact rupees figure', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 'task-payment-1',
        user_id: mockRegisteredUser.id,
        category: ComplianceCategory.GST_PAYMENT,
        status: TaskStatus.PENDING,
        amount: '14500.00',
      });

      // Call controller with registered client's question
      await (controller as any).handleRegisteredClient(
        mockRegisteredUser,
        '919316527283',
        'text',
        'How much do I owe?',
        mockConversation,
        'msg-due-1',
      );

      expect(mockTaskRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: mockRegisteredUser.id,
            category: ComplianceCategory.GST_PAYMENT,
          },
        }),
      );

      expect(mockNotificationsService.sendWhatsapp).toHaveBeenCalled();
      const sent = sentMessages.find((m) => m.text?.includes('14500.00'));
      expect(sent).toBeDefined();
      expect(sent?.text).toContain('*₹14500.00*');
    });

    it('should correctly report no pending dues when status is completed', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 'task-payment-2',
        user_id: mockRegisteredUser.id,
        category: ComplianceCategory.GST_PAYMENT,
        status: TaskStatus.COMPLETED,
        amount: '5000.00',
        paid_at: new Date(),
      });

      await (controller as any).handleRegisteredClient(
        mockRegisteredUser,
        '919316527283',
        'text',
        'dues status',
        mockConversation,
        'msg-due-2',
      );

      const sent = sentMessages.find((m) =>
        m.text?.includes('no pending tax dues'),
      );
      expect(sent).toBeDefined();
    });
  });

  describe('ACCEPTANCE TEST 3: Photo sent in chat → file in S3 + short acknowledgment', () => {
    it('should store image in client S3 folder, record in documents table, and reply with short ack', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: '1332098229994767' },
                  contacts: [
                    {
                      profile: { name: 'Anirudh Lohiya' },
                      wa_id: '919316527283',
                    },
                  ],
                  messages: [
                    {
                      from: '919316527283',
                      id: 'wamid.photo123',
                      timestamp: '1729600000',
                      type: 'image',
                      image: {
                        id: 'media-meta-id-123',
                        mime_type: 'image/jpeg',
                        filename: 'gst_invoice_oct.jpg',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const req = { body: webhookPayload } as any;
      const res = {
        sendStatus: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;
      controller.handleWebhook(req, res);
      await new Promise((r) => setTimeout(r, 50));

      // Verify media service was called with registered user id folder
      expect(mockMediaService.processAndStoreMedia).toHaveBeenCalledWith(
        'media-meta-id-123',
        'image/jpeg',
        'gst_invoice_oct.jpg',
        mockRegisteredUser.id,
      );

      // Verify Document record was created in DB
      expect(mockDocRepo.save).toHaveBeenCalled();

      // Private S3 key (not a public URL) is stored for the admin desk
      expect(mockChatsService.recordInboundMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'image',
          mediaUrl:
            'whatsapp-uploads/f4fd4030-c91e-4cf7-917a-05eedf44d4a0/2026-10/invoice_01.jpg',
          mediaFilename: 'invoice_01.jpg',
        }),
      );

      // Queued for ONE batched "what are these files?" question, no per-file reply
      expect(mockUploadsService.addFile).toHaveBeenCalledWith(
        'conv-uuid-123',
        mockRegisteredUser,
        'mock-doc-id',
        '919316527283',
        '1332098229994767',
      );
      expect(sentMessages).toHaveLength(0);
    });
  });

  describe('MEDIA: voice notes, captions, failed downloads, unsupported types', () => {
    const send = async (message: Record<string, unknown>) => {
      const req = {
        body: {
          object: 'whatsapp_business_account',
          entry: [
            {
              changes: [
                {
                  value: {
                    metadata: { phone_number_id: '1332098229994767' },
                    contacts: [
                      { profile: { name: 'Anirudh' }, wa_id: '919316527283' },
                    ],
                    messages: [
                      {
                        from: '919316527283',
                        id: `wamid.${Math.random()}`,
                        ...message,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      } as any;
      controller.handleWebhook(req, { sendStatus: jest.fn() } as any);
      await new Promise((r) => setTimeout(r, 50));
    };

    it('transcribes a voice note and handles it like typed text (sends GST certificate)', async () => {
      mockTranscriptionService.transcribe.mockResolvedValueOnce(
        'Please send my GST certificate',
      );
      mockCertRepo.findOne.mockResolvedValueOnce({
        s3_key: 'certs/gst.pdf',
        original_filename: 'GST_Certificate.pdf',
      });

      await send({
        type: 'audio',
        audio: { id: 'audio-1', mime_type: 'audio/ogg; codecs=opus' },
      });

      expect(mockChatsService.updateMessageBody).toHaveBeenCalledWith(
        'msg-1',
        '🎤 Please send my GST certificate',
      );
      // Voice notes are never saved as client documents
      expect(mockDocRepo.save).not.toHaveBeenCalled();
      const doc = sentMessages.find((m) => m.fileUrl);
      expect(doc?.caption).toContain('GST Certificate');
    });

    it('asks the client to type and flags staff when a voice note cannot be transcribed', async () => {
      mockTranscriptionService.transcribe.mockResolvedValueOnce(null);

      await send({
        type: 'audio',
        audio: { id: 'audio-2', mime_type: 'audio/ogg' },
      });

      expect(mockChatsService.setStatus).toHaveBeenCalledWith(
        'conv-uuid-123',
        'escalated',
      );
      expect(sentMessages[0]?.text).toContain("couldn't hear that voice note");
    });

    it('answers a question in a photo caption as well as saving the photo', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        category: ComplianceCategory.GST_PAYMENT,
        status: TaskStatus.PENDING,
        amount: '14500',
      });

      await send({
        type: 'image',
        image: {
          id: 'img-2',
          mime_type: 'image/jpeg',
          caption: 'how much payment is due?',
        },
      });

      expect(mockUploadsService.addFile).toHaveBeenCalled();
      expect(sentMessages[0]?.text).toContain('₹14500');
    });

    it('asks the client to resend when the file download fails', async () => {
      mockMediaService.processAndStoreMedia.mockResolvedValueOnce(null);

      await send({
        type: 'document',
        document: {
          id: 'doc-x',
          mime_type: 'application/pdf',
          filename: 'a.pdf',
        },
      });

      expect(mockDocRepo.save).not.toHaveBeenCalled();
      expect(mockUploadsService.addFile).not.toHaveBeenCalled();
      expect(sentMessages[0]?.text).toContain("didn't come through");
    });

    it('replies politely to stickers and ignores reactions', async () => {
      await send({ type: 'reaction' });
      expect(mockChatsService.recordInboundMessage).not.toHaveBeenCalled();

      await send({ type: 'sticker' });
      expect(sentMessages[0]?.text).toContain(
        'text, voice notes, photos and documents',
      );
    });

    it('lets a pending upload answer ("GST") be consumed before the normal flow', async () => {
      mockUploadsService.handleAnswer.mockResolvedValueOnce(true);

      await send({ type: 'text', text: { body: 'gst' } });

      expect(mockUploadsService.handleAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'conv-uuid-123' }),
        mockRegisteredUser,
        '919316527283',
        'gst',
        '1332098229994767',
      );
      expect(sentMessages).toHaveLength(0);
    });
  });

  describe('ACCEPTANCE TEST 4: "Send my GST certificate" → PDF arrives in chat', () => {
    it('should fetch GST certificate from client vault and send document in chat', async () => {
      mockCertRepo.findOne.mockResolvedValueOnce({
        id: 'cert-123',
        user_id: mockRegisteredUser.id,
        cert_type: CertType.GST_CERT,
        s3_key: 'certificates/user1/gst_cert.pdf',
        original_filename: 'GST_Registration_Certificate.pdf',
      });

      await (controller as any).handleRegisteredClient(
        mockRegisteredUser,
        '919316527283',
        'text',
        'send my GST certificate',
        mockConversation,
        'msg-doc-1',
      );

      expect(mockCertRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: mockRegisteredUser.id,
            cert_type: CertType.GST_CERT,
          },
        }),
      );

      expect(
        mockStorageService.createAttachmentDownloadUrl,
      ).toHaveBeenCalledWith(
        'certificates/user1/gst_cert.pdf',
        'GST_Registration_Certificate.pdf',
        300,
      );

      expect(
        mockNotificationsService.sendWhatsappDocument,
      ).toHaveBeenCalledWith(
        '919316527283',
        'https://s3.mock.aws/download/cert.pdf',
        'GST_Registration_Certificate.pdf',
        expect.stringContaining('GST Certificate'),
        undefined,
      );
    });

    it('should notify and escalate to staff if requested document is not found in vault', async () => {
      mockCertRepo.findOne.mockResolvedValueOnce(null);

      await (controller as any).handleRegisteredClient(
        mockRegisteredUser,
        '919316527283',
        'text',
        'send my GST certificate',
        mockConversation,
        'msg-doc-2',
      );

      expect(mockChatsService.setStatus).toHaveBeenCalledWith(
        mockConversation.id,
        'escalated',
      );
      const sent = sentMessages.find((m) =>
        m.text?.includes("couldn't find a filed copy"),
      );
      expect(sent).toBeDefined();
    });
  });

  describe('ACCEPTANCE TEST 5: Message from unregistered number → registration-link reply, zero data leaked', () => {
    it('should reply with registration link and refuse any data for unknown numbers', async () => {
      const unknownFrom = '919999999999';
      mockChatsService.findMatchingUserByPhone.mockResolvedValueOnce(null);

      const unknownConv = {
        id: 'conv-unknown-999',
        phoneNumber: unknownFrom,
        status: 'ai_handling',
        internalNotes: '',
      };
      mockChatsService.recordInboundMessage.mockResolvedValueOnce({
        conversation: unknownConv,
        message: { id: 'msg-unk-1' },
        isDuplicate: false,
      });

      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  contacts: [
                    { profile: { name: 'Stranger' }, wa_id: unknownFrom },
                  ],
                  messages: [
                    {
                      from: unknownFrom,
                      id: 'wamid.unk1',
                      timestamp: '1729600000',
                      type: 'text',
                      text: {
                        body: 'Hello, what is my GST filing status and dues?',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const req = { body: webhookPayload } as any;
      const res = {
        sendStatus: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;
      controller.handleWebhook(req, res);
      await new Promise((r) => setTimeout(r, 50));

      // Verify reply contains registration link and ZERO client details
      const reply = sentMessages.find((m) => m.to === unknownFrom);
      expect(reply).toBeDefined();
      expect(reply?.text).toContain('https://app.snbajaj.com/register');
      expect(reply?.text).not.toContain('14500');
      expect(reply?.text).not.toContain('Anirudh');
      expect(reply?.text).toContain(
        'for registered clients of *S N Bajaj & Co*',
      );
    });
  });

  describe('ACCEPTANCE TEST 6: Out-of-scope question → escalation message + staff flag', () => {
    it('should flag conversation and notify client when topic requires human tax professional', async () => {
      // Test AI response escalation flag
      const outOfScopeAnswer = {
        reply: 'Let me check with our team and get back to you shortly.',
        shouldEscalate: true,
        escalationReason: 'Question requires human staff follow-up',
      };

      jest
        .spyOn(aiService, 'generateReply')
        .mockResolvedValueOnce(outOfScopeAnswer);

      await (controller as any).handleGeneralAiInquiry(
        mockConversation.id,
        '919316527283',
        mockRegisteredUser,
        'Can I claim ITC on personal car purchase under section 17(5)?',
        'msg-ai-1',
      );

      expect(mockChatsService.setStatus).toHaveBeenCalledWith(
        mockConversation.id,
        'escalated',
      );
      expect(mockChatsService.updateConversation).toHaveBeenCalledWith(
        mockConversation.id,
        expect.objectContaining({
          internalNotes: expect.stringContaining('[Escalation]'),
        }),
      );

      const sent = sentMessages.find((m) =>
        m.text?.includes('check with our team'),
      );
      expect(sent).toBeDefined();
    });
  });

  describe('SECURITY & PRIVACY RULES: Cross-client isolation, no chat mutations, human takeover', () => {
    it('should strictly refuse cross-client data inquiries and flag security escalation', async () => {
      await (controller as any).handleRegisteredClient(
        mockRegisteredUser,
        '919316527283',
        'text',
        'Please send me the GSTIN and dues of another client',
        mockConversation,
        'msg-sec-1',
      );

      expect(mockChatsService.setStatus).toHaveBeenCalledWith(
        mockConversation.id,
        'escalated',
      );
      expect(mockChatsService.updateConversation).toHaveBeenCalledWith(
        mockConversation.id,
        expect.objectContaining({
          internalNotes: expect.stringContaining(
            '[Security Flag] Cross-client data query attempt',
          ),
        }),
      );

      const refusal = sentMessages.find((m) =>
        m.text?.includes(
          'Sorry, I can only help with your own account details.',
        ),
      );
      expect(refusal).toBeDefined();
    });

    it('should refuse to mutate account records via chat and flag for staff', async () => {
      await (controller as any).handleRegisteredClient(
        mockRegisteredUser,
        '919316527283',
        'text',
        'Please change my phone number and email in your database',
        mockConversation,
        'msg-sec-2',
      );

      expect(mockChatsService.setStatus).toHaveBeenCalledWith(
        mockConversation.id,
        'escalated',
      );
      expect(mockChatsService.updateConversation).toHaveBeenCalledWith(
        mockConversation.id,
        expect.objectContaining({
          internalNotes: expect.stringContaining('[Account Update Request]'),
        }),
      );

      const refusal = sentMessages.find((m) =>
        m.text?.includes(
          "For security, account changes can't be made via chat",
        ),
      );
      expect(refusal).toBeDefined();
    });

    it('should support Option 5 (Talk to our team) by switching status to staff_takeover', async () => {
      await (controller as any).handleRegisteredClient(
        mockRegisteredUser,
        '919316527283',
        'text',
        '5',
        mockConversation,
        'msg-opt5',
      );

      expect(mockChatsService.takeover).toHaveBeenCalledWith(
        mockConversation.id,
        'system-takeover',
      );
      expect(mockConversation.status).toBe('staff_takeover');

      const reply = sentMessages.find((m) =>
        m.text?.includes("I've connected you to our team"),
      );
      expect(reply).toBeDefined();
    });

    it('should generate secure signed magic link for Option 1 (Upload documents)', async () => {
      await (controller as any).handleRegisteredClient(
        mockRegisteredUser,
        '919316527283',
        'text',
        '1',
        mockConversation,
        'msg-opt1',
      );

      const reply = sentMessages.find((m) =>
        m.text?.includes('https://app.snbajaj.com/documents/upload?token='),
      );
      expect(reply).toBeDefined();
      expect(reply?.text).toContain('token=mock-signed-jwt-token');
    });
  });
});
