import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthTokensDto, LoginDto, RefreshDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Client (GST user) login' })
  loginUser(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.authService.loginUser(dto);
  }

  @Post('login/admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin (CA / staff) login' })
  loginAdmin(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.authService.loginAdmin(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token, issue new token pair' })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(@Body() dto: RefreshDto): Promise<{ success: boolean }> {
    await this.authService.logout(dto.refresh_token);
    return { success: true };
  }
}
