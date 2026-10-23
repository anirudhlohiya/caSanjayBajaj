import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FamilyMember } from '../entities/family-member.entity';
import { User } from '../entities/user.entity';
import { FamilyMembersService } from './family-members.service';

describe('FamilyMembersService', () => {
  let rows: FamilyMember[];
  let service: FamilyMembersService;

  const where = (r: FamilyMember, w: Partial<FamilyMember>) =>
    Object.entries(w).every(([k, v]) => r[k as keyof FamilyMember] === v);

  beforeEach(() => {
    rows = [];
    const members = {
      find: jest.fn(({ where: w }: { where: Partial<FamilyMember> }) =>
        Promise.resolve(rows.filter((r) => where(r, w))),
      ),
      count: jest.fn(({ where: w }: { where: Partial<FamilyMember> }) =>
        Promise.resolve(rows.filter((r) => where(r, w)).length),
      ),
      findOneBy: jest.fn((w: Partial<FamilyMember>) =>
        Promise.resolve(rows.find((r) => where(r, w)) ?? null),
      ),
      create: jest.fn((v: Partial<FamilyMember>) => v),
      save: jest.fn((v: FamilyMember) => {
        if (!v.id) {
          v.id = `m${rows.length + 1}`;
          rows.push(v);
        }
        return Promise.resolve(v);
      }),
      remove: jest.fn((v: FamilyMember) => {
        rows = rows.filter((r) => r !== v);
        return Promise.resolve(v);
      }),
    };
    const users = { exists: jest.fn().mockResolvedValue(true) };
    service = new FamilyMembersService(
      members as unknown as Repository<FamilyMember>,
      users as unknown as Repository<User>,
    );
  });

  it('allows the account holder plus 5 members, no more', async () => {
    for (let i = 0; i < 5; i++) {
      await service.create('u1', { name: `M${i}`, relation: 'son' });
    }
    await expect(
      service.create('u1', { name: 'Sixth', relation: 'other' }),
    ).rejects.toThrow(BadRequestException);
    // Another account has its own limit
    await expect(
      service.create('u2', { name: 'A', relation: 'spouse' }),
    ).resolves.toBeDefined();
  });

  it('rejects a duplicate PAN within the same family', async () => {
    await service.create('u1', {
      name: 'A',
      relation: 'spouse',
      pan: 'ABCDE1234F',
    });
    await expect(
      service.create('u1', { name: 'B', relation: 'son', pan: 'ABCDE1234F' }),
    ).rejects.toThrow(BadRequestException);
  });

  it("never exposes or edits another account's member", async () => {
    const m = await service.create('u1', { name: 'A', relation: 'spouse' });
    await expect(service.get('u2', m.id)).rejects.toThrow(NotFoundException);
    await expect(service.remove('u2', m.id)).rejects.toThrow(NotFoundException);
  });

  it('clears the PAN when an empty string is sent', async () => {
    const m = await service.create('u1', {
      name: 'A',
      relation: 'spouse',
      pan: 'ABCDE1234F',
    });
    const updated = await service.update('u1', m.id, { pan: '' });
    expect(updated.pan).toBeNull();
  });
});
