import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateTicketDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  subject: string;

  @ApiPropertyOptional({ enum: ['document_request', 'general', 'complaint', 'other'] })
  @IsOptional()
  @IsEnum(['document_request', 'general', 'complaint', 'other'])
  category?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class CreateTicketMessageDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: ['open', 'replied', 'closed'] })
  @IsEnum(['open', 'replied', 'closed'])
  status: string;
}

export class TicketAttachmentUploadDto {
  @ApiProperty({ description: 'ID of the ticket message the file belongs to' })
  @IsNotEmpty()
  @IsString()
  message_id: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  filename: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  content_type: string;

  @ApiProperty()
  @IsNotEmpty()
  file_size_bytes: number;
}
