import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsString, Length, Matches } from 'class-validator';
import { CertType } from '../../common/enums';

const CERT_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export class CreateCertificateUploadUrlDto {
  @ApiProperty({ enum: CertType })
  @IsEnum(CertType)
  cert_type: CertType;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  @Matches(/^[^/\\]+$/, {
    message: 'filename must not contain path separators',
  })
  filename: string;

  @ApiProperty({ enum: CERT_CONTENT_TYPES })
  @IsIn(CERT_CONTENT_TYPES, {
    message: `contentType must be one of: ${CERT_CONTENT_TYPES.join(', ')}`,
  })
  contentType: string;
}
