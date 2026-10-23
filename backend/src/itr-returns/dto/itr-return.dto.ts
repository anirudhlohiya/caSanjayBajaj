import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateItrReturnUploadUrlDto {
  @ApiProperty({ example: '2025-26' })
  @IsString()
  @Matches(/^[0-9]{4}-[0-9]{2}$/, {
    message: 'assessment_year must be in YYYY-YY format, e.g. 2025-26',
  })
  assessment_year: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  @Matches(/^[^/\\]+$/, {
    message: 'filename must not contain path separators',
  })
  filename: string;

  @ApiProperty({ enum: ['application/pdf'] })
  @IsIn(['application/pdf'], {
    message: 'Only application/pdf is allowed for ITR returns',
  })
  contentType: string;
}

export class ConfirmItrReturnDto {
  @ApiProperty({ example: '2025-26' })
  @IsString()
  @Matches(/^[0-9]{4}-[0-9]{2}$/, {
    message: 'assessment_year must be in YYYY-YY format, e.g. 2025-26',
  })
  assessment_year: string;

  @ApiPropertyOptional({
    description: 'Family member the return is for; omit for the account holder',
  })
  @IsOptional()
  @IsUUID()
  family_member_id?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  s3_key: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  filename: string;

  @ApiProperty({ description: 'File size in bytes (max 10 MB)' })
  @IsNumber()
  @Min(1)
  @Max(10 * 1024 * 1024, {
    message: 'ITR return PDF must be at most 10 MB',
  })
  size: number;
}
