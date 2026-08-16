import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreatePeriodDto {
  @ApiProperty({ example: 'July 2026' })
  @IsString()
  @Length(1, 30)
  period_label: string;

  @ApiProperty({ example: '2026-07' })
  @IsString()
  @Length(1, 7)
  period_code: string;

  @ApiProperty({ example: '2026-08-11' })
  @IsDateString()
  due_date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_open?: boolean;
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
}
