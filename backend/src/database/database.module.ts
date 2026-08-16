import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        database: process.env.DB_NAME ?? 'ca_sanjay_gst',
        username: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '',
        entities,
        synchronize: false,
        logging: process.env.DB_LOGGING === 'true',
      }),
    }),
  ],
})
export class DatabaseModule {}
