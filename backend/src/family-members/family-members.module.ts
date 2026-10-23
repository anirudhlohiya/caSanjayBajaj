import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyMember } from '../entities/family-member.entity';
import { User } from '../entities/user.entity';
import {
  AdminFamilyMembersController,
  MyFamilyMembersController,
} from './family-members.controller';
import { FamilyMembersService } from './family-members.service';

@Module({
  imports: [TypeOrmModule.forFeature([FamilyMember, User])],
  controllers: [MyFamilyMembersController, AdminFamilyMembersController],
  providers: [FamilyMembersService],
  exports: [FamilyMembersService],
})
export class FamilyMembersModule {}
