import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '../config/configuration';
import { DatabaseModule } from './database.module';
import { Admin } from '../entities/admin.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    TypeOrmModule.forFeature([Admin, GstFilingPeriod, User]),
  ],
})
export class SeedModule {}
