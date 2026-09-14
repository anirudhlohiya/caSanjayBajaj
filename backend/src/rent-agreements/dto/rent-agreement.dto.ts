import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { RentAgreementStatus } from '../../entities/rent-agreement.entity';

export class CreateRentAgreementDto {
  @IsString()
  @IsNotEmpty()
  template_id: string;

  @IsObject()
  form_data: Record<string, any>;

  @IsEnum(RentAgreementStatus)
  @IsOptional()
  status?: RentAgreementStatus;
}

export class UpdateRentAgreementDto {
  @IsObject()
  @IsOptional()
  form_data?: Record<string, any>;

  @IsEnum(RentAgreementStatus)
  @IsOptional()
  status?: RentAgreementStatus;
}
