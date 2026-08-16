import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ReminderChannel, ReminderStatus } from '../../common/enums';

export class SendReminderDto {
  @ApiPropertyOptional({
    description: 'Single client id (alternative to all_unfiled)',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Send to all clients who have not uploaded for the period',
  })
  @IsOptional()
  all_unfiled?: boolean;

  @ApiProperty()
  @IsUUID()
  filing_period_id: string;

  @ApiProperty({
    enum: ReminderChannel,
    isArray: true,
    example: ['push', 'email'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ReminderChannel, { each: true })
  channels: ReminderChannel[];
}

export class ReminderLogQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  filing_period_id?: string;

  @ApiPropertyOptional({ enum: ReminderChannel })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel;

  @ApiPropertyOptional({ enum: ReminderStatus })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  triggered_by?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  pageSize?: number;
}
