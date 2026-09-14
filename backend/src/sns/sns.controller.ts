import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SnsService } from './sns.service';

@Controller('sns')
export class SnsController {
  constructor(private readonly snsService: SnsService) {}

  @Post('notifications')
  @HttpCode(200)
  async receive(
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: 'ok' }> {
    await this.snsService.handle(body);
    return { status: 'ok' };
  }
}
