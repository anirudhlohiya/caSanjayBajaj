import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import type { PeriodSchedule } from '../../common/types/gst-schedule';

export class CreatePeriodDto {
  @ApiProperty({ example: 'July 2026' })
  @IsString()
  @Length(1, 30)
  period_label: string;

  @ApiProperty({ example: '2026-07' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Period code must look like 2026-07',
  })
  period_code: string;

  @ApiProperty({ example: '2026-08-11' })
  @IsDateString()
  due_date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_open?: boolean;

  /**
   * Optional per-category deadline + reminder schedule (docs/13 §6.2). When
   * absent, the default schedule is computed from `period_code`.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  schedule?: PeriodSchedule;
}

export class UpdatePeriodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  period_label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_open?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  schedule?: PeriodSchedule;
}
