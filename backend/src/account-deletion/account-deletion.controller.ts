import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AccountDeletionService } from './account-deletion.service';

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password: string;
}

@ApiTags('profile (client)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class AccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Post('delete-account')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({
    summary: 'Delete own account (locked now, erased after 30 days)',
  })
  request(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto) {
    return this.deletion.request(user.sub, dto.password);
  }
}
