import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Palette keys the admin can pick for a service's icon tile. */
export const SERVICE_ICON_COLORS = [
  'blue',
  'green',
  'purple',
  'orange',
  'red',
  'teal',
  'indigo',
  'slate',
  'amber',
  'pink',
] as const;

export class CreateServiceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional({
    description: 'URL key, e.g. "gst". Generated from the title if omitted.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug may only contain lowercase letters, numbers and dashes',
  })
  @Length(1, 80)
  slug?: string;

  @ApiProperty({ description: 'Short summary shown on the card' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Detail page in markdown' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body_md?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 100)
  price?: string;

  @ApiPropertyOptional({ description: 'Material Symbols icon name' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string;

  @ApiPropertyOptional({ enum: SERVICE_ICON_COLORS })
  @IsOptional()
  @IsIn(SERVICE_ICON_COLORS)
  icon_color?: string;

  @ApiPropertyOptional({
    description: 'Overrides the firm-wide contact number; empty to clear',
  })
  @IsOptional()
  @IsString()
  @Matches(/^$|^\+?[0-9 ]{8,16}$/, { message: 'Enter a valid phone number' })
  contact_phone?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  display_order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class ReorderServicesDto {
  @ApiProperty({ type: [String], description: 'Service ids in display order' })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

export class ServiceContactDto {
  @ApiPropertyOptional({ description: 'Number for the Call button' })
  @IsOptional()
  @IsString()
  @Matches(/^$|^\+?[0-9 ]{8,16}$/, { message: 'Enter a valid phone number' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Number for the WhatsApp button (defaults to phone)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^$|^\+?[0-9 ]{8,16}$/, { message: 'Enter a valid phone number' })
  whatsapp?: string;

  @ApiPropertyOptional({
    example: 'office@firm.com',
    description: 'Empty to clear',
  })
  @IsOptional()
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Enter a valid email' })
  email?: string;

  @ApiPropertyOptional({ description: 'Office address shown on Contact Us' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ description: 'Google Maps link for the office' })
  @IsOptional()
  @Matches(/^$|^https:\/\/\S+$/, {
    message: 'Map link must start with https://',
  })
  @MaxLength(500)
  map_url?: string;

  @ApiPropertyOptional({ example: '10:00', description: 'Opening time, IST' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Use HH:MM (24-hour)' })
  open_from?: string;

  @ApiPropertyOptional({ example: '19:00', description: 'Closing time, IST' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Use HH:MM (24-hour)' })
  open_to?: string;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5, 6],
    description: 'Working days, 0 = Sunday … 6 = Saturday',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  open_days?: number[];
}

export class ServiceEnquiryDto {
  @ApiPropertyOptional({ description: 'What the client wants help with' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
