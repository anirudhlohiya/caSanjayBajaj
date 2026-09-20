import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ReportShareLink } from '../entities/report-share-link.entity';
import { hashToken, ShareLinksService } from './share-links.service';

describe('ShareLinksService', () => {
  let service: ShareLinksService;
  let saved: ReportShareLink[];
  let saveMock: jest.Mock;
  let createMock: jest.Mock;
  let findOneMock: jest.Mock;

  const config = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'shareLinks.ttlDays') return 30;
      return undefined;
    }),
  } as unknown as ConfigService;

  const linkRow = (overrides: Partial<ReportShareLink> = {}) =>
    ({
      id: 'l1',
      report_id: 'r1',
      token_hash: 'abc',
      expires_at: overrides.expires_at ?? new Date(Date.now() + 30 * 86400_000),
      ...overrides,
    }) as ReportShareLink;

  beforeEach(() => {
    saved = [];
    saveMock = jest.fn((v: ReportShareLink) => {
      const row = { ...v, id: v.id ?? `l${saved.length + 1}` };
      saved.push(row);
      return Promise.resolve(row);
    });
    createMock = jest.fn((v: object) => v);
    findOneMock = jest
      .fn()
      .mockImplementation(
        (opts: { where?: { token_hash?: string }; relations?: string[] }) => {
          const row =
            saved.find((r) => r.token_hash === opts?.where?.token_hash) ?? null;
          return Promise.resolve(row);
        },
      );

    const repo = {
      save: saveMock,
      create: createMock,
      findOne: findOneMock,
    } as unknown as Repository<ReportShareLink>;

    service = new ShareLinksService(repo, config);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createLink', () => {
    it('stores sha256(token) with a 30-day expiry and returns the raw token', async () => {
      const issued = await service.createLink('r1');

      expect(typeof issued.token).toBe('string');
      expect(issued.token.length).toBeGreaterThanOrEqual(32);
      expect(issued.expires_at.getTime()).toBeGreaterThan(Date.now());
      expect(saved).toHaveLength(1);
      expect(saved[0].token_hash).toBe(hashToken(issued.token));
      expect(saved[0].report_id).toBe('r1');
      // ~30 days out
      expect(
        Math.abs(issued.expires_at.getTime() - Date.now() - 30 * 86400_000),
      ).toBeLessThan(5000);
    });

    it('never stores the readable token', async () => {
      const issued = await service.createLink('r1');
      expect(JSON.stringify(saved[0]).includes(issued.token)).toBe(false);
    });
  });

  describe('findByToken', () => {
    it('resolves a valid token to the link with the report loaded', async () => {
      saved = [
        linkRow({ token_hash: 'abc', report: {} as ReportShareLink['report'] }),
      ];
      findOneMock.mockImplementation(() => Promise.resolve(saved[0]));

      const link = await service.findByToken('unknown-raw');
      expect(link).not.toBeNull();
      expect(findOneMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token_hash: hashToken('unknown-raw') },
        }),
      );
    });

    it('returns null for an unknown token', async () => {
      const link = await service.findByToken('nope');
      expect(link).toBeNull();
    });
  });
});
