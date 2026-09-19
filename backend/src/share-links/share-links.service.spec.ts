/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ShareLinksService, hashToken } from './share-links.service';
import { ReportShareLink } from '../entities/report-share-link.entity';
import { Repository } from 'typeorm';

describe('ShareLinksService', () => {
  let service: ShareLinksService;
  let linksRepo: jest.Mocked<Repository<ReportShareLink>>;

  beforeEach(async () => {
    linksRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ id: 'link-id', ...entity }),
        ),
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareLinksService,
        {
          provide: getRepositoryToken(ReportShareLink),
          useValue: linksRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(30), // ttlDays = 30
          },
        },
      ],
    }).compile();

    service = module.get<ShareLinksService>(ShareLinksService);
  });

  describe('createLink', () => {
    it('creates a link with hashed token and expiry', async () => {
      const { token, expires_at } = await service.createLink('report-1');

      expect(token).toBeDefined();
      expect(expires_at).toBeInstanceOf(Date);

      expect(linksRepo.create).toHaveBeenCalledWith({
        report_id: 'report-1',
        token_hash: hashToken(token),
        expires_at: expires_at,
      });
      expect(linksRepo.save).toHaveBeenCalled();
    });
  });

  describe('findByToken', () => {
    it('looks up link by hashed token', async () => {
      const mockLink = { id: 'link-id' };
      linksRepo.findOne.mockResolvedValue(mockLink as any);

      const result = await service.findByToken('test-token');

      expect(result).toBe(mockLink);
      expect(linksRepo.findOne).toHaveBeenCalledWith({
        where: { token_hash: hashToken('test-token') },
        relations: { report: { filing_period: true } },
      });
    });
  });
});
