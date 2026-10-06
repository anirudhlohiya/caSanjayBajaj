import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  ChangePasswordDto,
  RegisterDeviceTokenDto,
  UpdateProfileDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('profile (client)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get own profile' })
  get(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch()
  @ApiOperation({ summary: 'Update own profile' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Post('photo')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Upload profile photo' })
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^(image\/jpeg|image\/png|image\/webp|image\/jpg)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.updateProfilePhoto(user.sub, file);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user.sub, dto);
    return { success: true };
  }

  @Post('device-token')
  @ApiOperation({ summary: 'Register a push subscription / device token' })
  registerDeviceToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.usersService.registerDeviceToken(user.sub, dto);
  }

  @Delete('device-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister a push subscription / device token' })
  async unregisterDeviceToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: { push_token: string },
  ) {
    await this.usersService.unregisterDeviceToken(user.sub, dto.push_token);
    return { success: true };
  }
}
