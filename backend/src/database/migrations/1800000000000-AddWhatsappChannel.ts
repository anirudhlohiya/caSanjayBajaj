import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappChannel1800000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "reminders_channel_enum" ADD VALUE IF NOT EXISTS 'whatsapp'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing values from an enum type.
  }
}
