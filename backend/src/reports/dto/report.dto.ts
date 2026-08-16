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
import { ReportType } from '../../common/enums';

export class CreateReportDto {
  @ApiProperty()
  @IsUUID()
  user_id: string;

  @ApiProperty()
  @IsUUID()
  filing_period_id: string;

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
}

export class ReportFilterQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  filing_period_id?: string;

  @ApiPropertyOptional({ enum: ReportType })
  @IsOptional()
  @IsEnum(ReportType)
  report_type?: ReportType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  pageSize?: number;
}
