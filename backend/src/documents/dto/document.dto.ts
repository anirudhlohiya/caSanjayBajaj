import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { DocumentFileType, DocumentStatus } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination';

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
  filename: string;

  @ApiProperty()
  @IsString()
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
