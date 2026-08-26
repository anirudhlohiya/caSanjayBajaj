import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class SendOtpDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['signup', 'reset_password'] })
  @IsIn(['signup', 'reset_password'])
  purpose: 'signup' | 'reset_password';
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  otp_code: string;

  @ApiProperty({ enum: ['signup', 'reset_password'] })
  @IsIn(['signup', 'reset_password'])
  purpose: 'signup' | 'reset_password';
}

export class SignupDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'GSTIN (15 chars) — required for GST clients' })
  @IsOptional()
  @IsString()
  @Length(15, 15, { message: 'GSTIN must be exactly 15 characters' })
  gstin?: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;
}
