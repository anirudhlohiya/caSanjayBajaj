import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { DUE_DATE_AUDIENCES } from '../default-due-dates';

export const DUE_DATE_CATEGORIES = ['gst', 'income_tax', 'tds'] as const;

export class CreateDueDateDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional({ description: 'Form / return code, e.g. GSTR-3B' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  form?: string;

  @ApiProperty({ enum: DUE_DATE_CATEGORIES })
  @IsIn(DUE_DATE_CATEGORIES)
  category: string;

  @ApiProperty({ example: '2026-11-20' })
  @IsDateString({ strict: true })
  due_date: string;

  @ApiPropertyOptional({
    description: 'Date before an extension; empty when not extended',
  })
  @IsOptional()
  @Matches(/^$|^\d{4}-\d{2}-\d{2}$/, { message: 'Use YYYY-MM-DD' })
  original_due_date?: string;

  @ApiPropertyOptional({ example: 'October 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  period_label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: DUE_DATE_AUDIENCES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(DUE_DATE_AUDIENCES, { each: true })
  audiences: string[];

  @ApiProperty({ example: '2026-27' })
  @Matches(/^\d{4}-\d{2}$/, { message: 'Financial year like 2026-27' })
  fy: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateDueDateDto extends PartialType(CreateDueDateDto) {}

export class DueDateQueryDto {
  @ApiPropertyOptional({ example: '2026-27' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  fy?: string;
}
