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
import { ReportRequestStatus, ReportType } from '../../common/enums';

export class CreateReportRequestDto {
  @ApiProperty()
  @IsUUID()
  filing_period_id: string;
}

export class ReportRequestFilterQueryDto {
  @ApiPropertyOptional({ enum: ReportRequestStatus })
  @IsOptional()
  status?: ReportRequestStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  pageSize?: number;
}

export class FulfillReportRequestDto {
  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  report_type: ReportType;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  filename: string;

  @ApiProperty()
  @IsString()
  contentType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @Min(1)
  @Max(50 * 1024 * 1024)
  file_size_bytes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sales?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purchases?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  total_liability?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itc_claimed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  net_payable?: string;
}
