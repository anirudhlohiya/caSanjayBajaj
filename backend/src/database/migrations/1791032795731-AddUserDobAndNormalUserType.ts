import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDobAndNormalUserType1791032795731 implements MigrationInterface {
  name = 'AddUserDobAndNormalUserType1791032795731';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add dob column to users
    await queryRunner.query(`ALTER TABLE "users" ADD "dob" date`);
    // Update user_type enum to add 'normal' (and keep existing values)
    // Ensure 'normal' value exists in existing enum types (may already be added)
    await queryRunner.query(
      `ALTER TYPE "public"."users_user_type_enum" ADD VALUE IF NOT EXISTS 'normal'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."client_pre_registrations_user_type_enum" ADD VALUE IF NOT EXISTS 'normal'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep existing enum names as is; no changes needed on down if values remain
    await queryRunner.query(
      `ALTER TYPE "public"."users_user_type_enum" ADD VALUE IF NOT EXISTS 'normal'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."client_pre_registrations_user_type_enum" ADD VALUE IF NOT EXISTS 'normal'`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "dob"`);
  }
}
