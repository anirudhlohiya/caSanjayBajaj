import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  GstFilingFrequency,
  ServiceRequestType,
  UserType,
} from '../../common/enums';

export class CreateServiceRequestDto {
  @ApiProperty({ enum: ServiceRequestType })
  @IsEnum(ServiceRequestType)
  requested_type: ServiceRequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiPropertyOptional({ enum: GstFilingFrequency })
  @IsOptional()
  @IsEnum(GstFilingFrequency)
  filing_frequency?: GstFilingFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pan?: string;
}

export class ReviewServiceRequestDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ChangeClientTypeDto {
  @ApiProperty({
    enum: [UserType.GENERAL, UserType.GST, UserType.ITR, UserType.BOTH],
  })
  @IsIn([UserType.GENERAL, UserType.GST, UserType.ITR, UserType.BOTH])
  user_type: UserType;
}
