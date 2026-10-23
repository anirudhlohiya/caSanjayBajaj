import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyMember } from '../entities/family-member.entity';
import { User } from '../entities/user.entity';
import {
  CreateFamilyMemberDto,
  MAX_FAMILY_MEMBERS,
  UpdateFamilyMemberDto,
} from './dto/family-member.dto';

@Injectable()
export class FamilyMembersService {
  constructor(
    @InjectRepository(FamilyMember)
    private readonly members: Repository<FamilyMember>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  list(userId: string): Promise<FamilyMember[]> {
    return this.members.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
    });
  }

  async create(
    userId: string,
    dto: CreateFamilyMemberDto,
  ): Promise<FamilyMember> {
    if (!(await this.users.exists({ where: { id: userId } }))) {
      throw new NotFoundException('Client not found');
    }
    const count = await this.members.count({ where: { user_id: userId } });
    if (count >= MAX_FAMILY_MEMBERS) {
      throw new BadRequestException(
        `You can add up to ${MAX_FAMILY_MEMBERS} family members`,
      );
    }
    await this.assertPanFree(userId, dto.pan);
    return this.members.save(
      this.members.create({
        user_id: userId,
        name: dto.name,
        relation: dto.relation,
        pan: dto.pan || null,
      }),
    );
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFamilyMemberDto,
  ): Promise<FamilyMember> {
    const member = await this.get(userId, id);
    if (dto.pan !== undefined && dto.pan !== member.pan) {
      await this.assertPanFree(userId, dto.pan, id);
      member.pan = dto.pan || null;
    }
    if (dto.name !== undefined) member.name = dto.name;
    if (dto.relation !== undefined) member.relation = dto.relation;
    return this.members.save(member);
  }

  /** Deleting a member also deletes their ITR returns and documents (cascade). */
  async remove(userId: string, id: string): Promise<void> {
    await this.members.remove(await this.get(userId, id));
  }

  /** A member of this account, or 404 (also used to validate member ids). */
  async get(userId: string, id: string): Promise<FamilyMember> {
    const member = await this.members.findOneBy({ id, user_id: userId });
    if (!member) throw new NotFoundException('Family member not found');
    return member;
  }

  private async assertPanFree(
    userId: string,
    pan: string | undefined,
    exceptId?: string,
  ): Promise<void> {
    if (!pan) return;
    const clash = await this.members.findOneBy({ user_id: userId, pan });
    if (clash && clash.id !== exceptId) {
      throw new BadRequestException(
        'A family member with this PAN already exists',
      );
    }
  }
}
