import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { FAQ_CATEGORIES } from '../default-faqs';

export class CreateFaqDto {
  @ApiProperty({ enum: FAQ_CATEGORIES })
  @IsIn(FAQ_CATEGORIES)
  category: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 300)
  question: string;

  @ApiProperty({ description: 'Answer in markdown' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  answer_md: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class ReorderFaqsDto {
  @ApiProperty({ type: [String], description: 'FAQ ids in display order' })
  @IsArray()
  @IsUUID('all', { each: true })
  ids: string[];
}
