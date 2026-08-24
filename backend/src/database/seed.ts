import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import type { Repository } from 'typeorm';
import { Admin } from '../entities/admin.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { User } from '../entities/user.entity';
import { AdminRole, UserType, UserStatus } from '../common/enums';
import { SeedModule } from './seed.module';

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const admins: Repository<Admin> = app.get(getRepositoryToken(Admin));
  const periods: Repository<GstFilingPeriod> = app.get(
    getRepositoryToken(GstFilingPeriod),
  );
  const users: Repository<User> = app.get(getRepositoryToken(User));

  // Seed Super Admin
  const email = config.get<string>('superAdmin.email');
  const password = config.get<string>('superAdmin.password');
  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env to seed',
    );
  }
  const exists = await admins.findOneBy({ email: email.toLowerCase() });
  if (!exists) {
    await admins.save(
      admins.create({
        name: config.get<string>('superAdmin.name') ?? 'Super Admin',
        email: email.toLowerCase(),
        password_hash: await argon2.hash(password),
        role: AdminRole.SUPER_ADMIN,
      }),
    );
    console.log('Super Admin created:', email);
  } else {
    console.log('Super Admin already exists — skipping');
  }

  // Seed Test Client User
  const clientEmail = 'anirudhlohiya999@gmail.com';
  const clientPassword = 'Client@2026';
  const clientExists = await users.findOneBy({ email: clientEmail });
  if (!clientExists) {
    await users.save(
      users.create({
        name: 'Anirudh Lohiya',
        email: clientEmail,
        password_hash: await argon2.hash(clientPassword),
        user_type: UserType.GST,
        status: UserStatus.ACTIVE,
      }),
    );
    console.log('Test Client User created:', clientEmail);
  } else {
    console.log('Test Client User already exists — skipping');
  }

  // Seed default filing periods (current + next 2 months)
  const now = new Date();
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const periodCode = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const periodLabel = d.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    // Due date: 11th of the following month (typical GSTR-1/3B) — configurable later
    const due = new Date(d.getFullYear(), d.getMonth() + 1, 11);
    const existing = await periods.findOneBy({ period_code: periodCode });
    if (!existing) {
      await periods.save(
        periods.create({
          period_label: periodLabel,
          period_code: periodCode,
          due_date: due.toISOString().slice(0, 10),
          is_open: true,
        }),
      );
      console.log('Filing period created:', periodLabel);
    }
  }

  await app.close();
  console.log('Seed complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
