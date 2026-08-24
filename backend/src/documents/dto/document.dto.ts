import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DocumentFileType, DocumentStatus } from '../../common/enums';
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

  @ApiProperty()
  @IsUUID()
  filing_period_id: string;

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
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  filing_period_id?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

export class SetProcessedDto {
  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}
