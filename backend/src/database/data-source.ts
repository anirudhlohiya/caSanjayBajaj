import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { entities } from '../entities';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'ca_sanjay_gst',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  entities,
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
