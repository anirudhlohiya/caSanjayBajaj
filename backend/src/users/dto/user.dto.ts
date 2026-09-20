import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { GstFilingFrequency, UserStatus, UserType } from '../../common/enums';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (o: { user_type: UserType | undefined }) => o.user_type === UserType.GST,
  )
  @IsNotEmpty({ message: 'Phone is required for GST clients' })
  @IsString()
  @Length(10, 20)
  phone?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (o: { user_type: UserType | undefined }) => o.user_type === UserType.GST,
  )
  @IsNotEmpty({ message: 'GSTIN is required for GST clients' })
  @IsString()
  @Length(15, 15)
  gstin?: string;

  @ApiPropertyOptional({ enum: UserType })
  @IsOptional()
  @IsEnum(UserType)
  user_type?: UserType;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    enum: GstFilingFrequency,
    default: GstFilingFrequency.MONTHLY,
  })
  @IsOptional()
  @IsEnum(GstFilingFrequency)
  gst_filing_frequency?: GstFilingFrequency;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(10, 20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(15, 15)
  gstin?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: GstFilingFrequency })
  @IsOptional()
  @IsEnum(GstFilingFrequency)
  gst_filing_frequency?: GstFilingFrequency;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(10, 20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(15, 15)
  gstin?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  current_password: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  new_password: string;
}

export class RegisterDeviceTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  push_token: string;

  @ApiPropertyOptional({ enum: ['pwa', 'android'], default: 'pwa' })
  @IsOptional()
  @IsEnum(['pwa', 'android'])
  platform?: 'pwa' | 'android';
}

export class UserIdParamDto {
  @ApiProperty()
  @IsUUID()
  id: string;
}
