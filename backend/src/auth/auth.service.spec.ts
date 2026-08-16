import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { Admin } from '../entities/admin.entity';
import { Permission } from '../entities/permission.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  const users = {
    createQueryBuilder: jest.fn(),
    findOneBy: jest.fn(),
  } as unknown as Repository<User>;
  const admins = {
    createQueryBuilder: jest.fn(),
    findOneBy: jest.fn(),
  } as unknown as Repository<Admin>;
  const permissions = {
    find: jest.fn(),
  } as unknown as Repository<Permission>;
  const refreshTokens = {
    save: jest.fn(),
    create: jest.fn((v) => v),
    findOne: jest.fn(),
    update: jest.fn(),
  } as unknown as Repository<RefreshToken>;
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
    sign: jest.fn().mockReturnValue('refresh-token'),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: 'UserRepository', useValue: users },
        { provide: 'AdminRepository', useValue: admins },
        { provide: 'PermissionRepository', useValue: permissions },
        { provide: 'RefreshTokenRepository', useValue: refreshTokens },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('loginUser', () => {
    it('returns tokens for valid credentials', async () => {
      const passwordHash = await argon2.hash('password123');
      (users.createQueryBuilder as jest.Mock).mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'client@example.com',
          password_hash: passwordHash,
          status: 'active',
        }),
      });

      const result = await service.loginUser({
        email: 'client@example.com',
        password: 'password123',
      });

      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).toBe('refresh-token');
      expect(refreshTokens.save).toHaveBeenCalled();
    });

    it('rejects invalid password', async () => {
      (users.createQueryBuilder as jest.Mock).mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'client@example.com',
          password_hash: await argon2.hash('correct'),
          status: 'active',
        }),
      });

      await expect(
        service.loginUser({ email: 'client@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects unknown email', async () => {
      (users.createQueryBuilder as jest.Mock).mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.loginUser({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});