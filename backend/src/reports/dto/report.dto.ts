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
