import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export const FAMILY_RELATIONS = [
  'spouse',
  'son',
  'daughter',
  'father',
  'mother',
  'brother',
  'sister',
  'other',
] as const;

/** Account holder + this many members. */
export const MAX_FAMILY_MEMBERS = 5;

const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateFamilyMemberDto {
  @ApiProperty({ example: 'Sunita Lohiya' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({ enum: FAMILY_RELATIONS })
  @IsIn(FAMILY_RELATIONS)
  relation: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F', description: 'Empty to clear' })
  @IsOptional()
  @Transform(trimUpper)
  @Matches(/^$|^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: 'PAN must look like ABCDE1234F',
  })
  pan?: string;
}

export class UpdateFamilyMemberDto extends PartialType(CreateFamilyMemberDto) {}
