import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

export interface AppVersionResponse {
  platform: 'android';
  min_version: string;
  latest_version: string;
  store_url: string;
}

@ApiTags('app')
@Controller('app')
export class AppVersionController {
  constructor(private readonly config: ConfigService) {}

  @Get('version')
  @ApiOperation({
    summary: 'Minimum/latest Android app version for forced updates',
  })
  version(): AppVersionResponse {
    return {
      platform: 'android',
      min_version: this.config.get<string>('androidApp.minVersion', '1.0.0'),
      latest_version: this.config.get<string>(
        'androidApp.latestVersion',
        '1.0.0',
      ),
      store_url: this.config.get<string>(
        'androidApp.storeUrl',
        'https://play.google.com/store/apps/details?id=com.snbajaj.portal',
      ),
    };
  }
}
