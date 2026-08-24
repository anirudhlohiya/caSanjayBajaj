import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthTokensDto, LoginDto, RefreshDto } from './dto/auth.dto';
import {
  SendOtpDto,
  VerifyOtpDto,
  SignupDto,
  ResetPasswordDto,
} from './dto/otp.dto';

const AUTH_ATTEMPTS = { default: { limit: 5, ttl: 60_000 } };
const OTP_FLOWS = { default: { limit: 3, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/user')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_ATTEMPTS)
  @ApiOperation({ summary: 'Client (GST user) login' })
  loginUser(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.authService.loginUser(dto);
  }

  @Post('login/admin')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_ATTEMPTS)
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

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @Throttle(OTP_FLOWS)
  @ApiOperation({ summary: 'Send email OTP code' })
  sendOtp(@Body() dto: SendOtpDto): Promise<{ success: boolean }> {
    return this.authService.sendOtp(dto);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(OTP_FLOWS)
  @ApiOperation({ summary: 'Verify email OTP code' })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ success: boolean }> {
    return this.authService.verifyOtp(dto);
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(OTP_FLOWS)
  @ApiOperation({ summary: 'Client self-registration with OTP' })
  signup(@Body() dto: SignupDto): Promise<AuthTokensDto> {
    return this.authService.signup(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(OTP_FLOWS)
  @ApiOperation({ summary: 'Reset client password with OTP' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: boolean }> {
    return this.authService.resetPassword(dto);
  }
}
