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

  const allUsers = await users.find();
  console.log('Users in DB:', allUsers.map(u => ({ id: u.id, name: u.name, dob: u.dob })));

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  console.log(`Searching for Month: ${month}, Day: ${day}`);

  const birthdayUsers = await users.createQueryBuilder('user')
    .where(`EXTRACT(MONTH FROM user.dob) = :month AND EXTRACT(DAY FROM user.dob) = :day`, { month, day })
    .getMany();
    
  console.log('Users found with birthday today:', birthdayUsers);

  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
