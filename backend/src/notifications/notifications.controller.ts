import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { NotificationsService } from './notifications.service';

export class TestWhatsappDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiPropertyOptional({
    description: 'Required if templateName is not provided',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'Pre-approved template name like hello_world',
  })
  @IsString()
  @IsOptional()
  templateName?: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test-whatsapp')
  @ApiOperation({ summary: 'Test sending a WhatsApp message or template' })
  async testWhatsapp(@Body() body: TestWhatsappDto) {
    if (body.templateName) {
      const success = await this.notificationsService.sendWhatsappTemplate(
        body.phoneNumber,
        body.templateName,
      );
      return { success };
    } else {
      const success = await this.notificationsService.sendWhatsapp(
        body.phoneNumber,
        body.message ?? '',
      );
      return { success };
    }
  }
}
