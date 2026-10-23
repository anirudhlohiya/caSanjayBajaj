import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  DocumentCategory,
  DocumentFileType,
  DocumentStatus,
} from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination';

// MIME types the firm accepts for client documents/reports.
const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/zip',
] as const;

export class CreateUploadUrlDto {
  @ApiProperty({ description: 'Client user id (admin only; client uses self)' })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({
    enum: DocumentCategory,
    default: DocumentCategory.GST,
  })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  filing_period_id?: string;

  @ApiPropertyOptional({ example: '2025-26' })
  @IsOptional()
  @IsString()
  assessment_year?: string;

  @ApiPropertyOptional({
    description: 'ITR only: family member the document is for (omit for self)',
  })
  @IsOptional()
  @IsUUID()
  family_member_id?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  @Matches(/^[^/\\]+$/, {
    message: 'filename must not contain path separators',
  })
  filename: string;

  @ApiProperty({ enum: ALLOWED_CONTENT_TYPES })
  @IsIn(ALLOWED_CONTENT_TYPES, {
    message: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
  })
  contentType: string;

  @ApiProperty({ enum: DocumentFileType })
  @IsEnum(DocumentFileType)
  file_type: DocumentFileType;

  @ApiProperty({ description: 'File size in bytes' })
  @Min(1)
  @Max(50 * 1024 * 1024)
  file_size_bytes: number;
}

export class ConfirmUploadDto {
  @ApiProperty({ description: 'Size in bytes actually uploaded' })
  @Min(1)
  @Max(50 * 1024 * 1024)
  file_size_bytes: number;
}

export class DocumentStatusQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  filing_period_id?: string;

  @ApiPropertyOptional({ example: '2025-26' })
  @IsOptional()
  @IsString()
  assessment_year?: string;

  @ApiPropertyOptional({
    description: "A family member id, or 'self' for the account holder only",
  })
  @IsOptional()
  @Matches(/^(self|[0-9a-f-]{36})$/i, {
    message: "family_member_id must be a member id or 'self'",
  })
  family_member_id?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description:
      'Only WhatsApp files not yet filed under a GST month or ITR year',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassigned?: boolean;
}

export class AssignDocumentDto {
  @ApiProperty({ enum: DocumentCategory })
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @ApiPropertyOptional({ description: 'Required for GST documents' })
  @ValidateIf((o: AssignDocumentDto) => o.category === DocumentCategory.GST)
  @IsUUID()
  filing_period_id?: string;

  @ApiPropertyOptional({ example: '2026-27' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'assessment_year must be in YYYY-YY format, e.g. 2026-27',
  })
  assessment_year?: string;
}

export class SetProcessedDto {
  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}
