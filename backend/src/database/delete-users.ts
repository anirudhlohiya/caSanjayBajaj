import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { SeedModule } from './seed.module';

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    bufferLogs: true,
  });

  const users: Repository<User> = app.get(getRepositoryToken(User));

  // Truncate the users table and cascade delete related entities (like documents, device_tokens, etc.)
  await users.query('TRUNCATE TABLE "users" CASCADE;');

  console.log('Successfully deleted all users (clients) from the database.');

  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
