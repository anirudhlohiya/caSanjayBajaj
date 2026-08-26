/**
 * One-time script to import GST clients from an Excel file into client_pre_registrations.
 *
 * Usage:
 *   cd backend
 *   npx ts-node scripts/import-clients.ts path/to/clients.xlsx
 *
 * Excel columns expected:
 *   name      (required) - Company or individual name
 *   email     (required) - Login email, must be unique
 *   phone     (required) - 10-20 digits
 *   gstin     (required for GST) - Exactly 15 alphanumeric characters
 *   user_type (optional) - "GST" or "ITR", defaults to "GST"
 *
 * The script will:
 *   1. Parse the Excel file
 *   2. Validate each row
 *   3. Insert into client_pre_registrations table
 *   4. Skip duplicates (email or GSTIN already exists)
 *   5. Print a summary report
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as argon2 from 'argon2';
import { entities } from '../src/entities';
import { UserType } from '../src/common/enums';

config();

interface ImportRow {
  name: string;
  email: string;
  phone: string;
  gstin: string;
  user_type: string;
}

interface ImportError {
  row: number;
  email: string;
  reason: string;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx ts-node scripts/import-clients.ts <excel-file-path>');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  console.log(`Reading Excel file: ${absolutePath}`);

  const workbook = XLSX.readFile(absolutePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error('No sheets found in the Excel file');
    process.exit(1);
  }

  const rows: ImportRow[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  console.log(`Found ${rows.length} rows in sheet "${sheetName}"`);

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'ca_sanjay_gst',
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    entities,
    synchronize: false,
  });

  await ds.initialize();
  console.log('Connected to database');

  const preRegRepo = ds.getRepository('ClientPreRegistration');
  const userRepo = ds.getRepository('User');

  let created = 0;
  let skipped = 0;
  const errors: ImportError[] = [];

  // Fetch existing emails and GSTINs for dedup
  const existingUsers = await userRepo.find({ select: { email: true, gstin: true } });
  const existingPreRegs = await preRegRepo.find({ select: { email: true, gstin: true } });
  const existingEmails = new Set(
    [...existingUsers, ...existingPreRegs].map((u: any) => u.email?.toLowerCase()),
  );
  const existingGstins = new Set(
    [...existingUsers, ...existingPreRegs]
      .filter((u: any) => u.gstin)
      .map((u: any) => u.gstin.toUpperCase()),
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel rows start at 1, header is row 1
    const email = (row.email ?? '').trim().toLowerCase();
    const name = (row.name ?? '').trim();
    const phone = (row.phone ?? '').toString().trim();
    const gstin = (row.gstin ?? '').trim().toUpperCase();
    const userType = (row.user_type ?? 'GST').trim().toUpperCase();

    // Validation
    if (!name) {
      errors.push({ row: rowNum, email, reason: 'Missing name' });
      skipped++;
      continue;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, email: email || '(empty)', reason: 'Invalid or missing email' });
      skipped++;
      continue;
    }
    if (!phone || !/^\d{10,20}$/.test(phone)) {
      errors.push({ row: rowNum, email, reason: 'Invalid or missing phone (10-20 digits required)' });
      skipped++;
      continue;
    }
    if (userType === 'GST' && (!gstin || !/^[0-9A-Za-z]{15}$/.test(gstin))) {
      errors.push({ row: rowNum, email, reason: 'Invalid or missing GSTIN (15 characters required for GST)' });
      skipped++;
      continue;
    }

    // Dedup check
    if (existingEmails.has(email)) {
      errors.push({ row: rowNum, email, reason: 'Email already exists' });
      skipped++;
      continue;
    }
    if (gstin && existingGstins.has(gstin)) {
      errors.push({ row: rowNum, email, reason: `GSTIN ${gstin} already exists` });
      skipped++;
      continue;
    }

    // Insert
    try {
      await preRegRepo.save(
        preRegRepo.create({
          name,
          email,
          phone,
          gstin: gstin || null,
          user_type: userType === 'ITR' ? UserType.ITR : UserType.GST,
          status: 'active',
        }),
      );
      existingEmails.add(email);
      if (gstin) existingGstins.add(gstin);
      created++;
    } catch (err: any) {
      errors.push({ row: rowNum, email, reason: `DB error: ${err.message}` });
      skipped++;
    }
  }

  await ds.destroy();

  // Summary
  console.log('\n========== IMPORT SUMMARY ==========');
  console.log(`Total rows:    ${rows.length}`);
  console.log(`Created:       ${created}`);
  console.log(`Skipped:       ${skipped}`);

  if (errors.length > 0) {
    console.log('\n--- Errors ---');
    for (const e of errors) {
      console.log(`  Row ${e.row} (${e.email}): ${e.reason}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
