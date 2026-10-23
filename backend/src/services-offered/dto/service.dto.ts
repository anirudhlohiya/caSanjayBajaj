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
}

export class ServiceEnquiryDto {
  @ApiPropertyOptional({ description: 'What the client wants help with' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
