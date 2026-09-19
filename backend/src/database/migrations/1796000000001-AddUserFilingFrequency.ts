import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserFilingFrequency1796000000001 implements MigrationInterface {
  name = 'AddUserFilingFrequency1796000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_gst_filing_frequency_enum" AS ENUM('monthly', 'quarterly')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "gst_filing_frequency" "public"."users_gst_filing_frequency_enum" NOT NULL DEFAULT 'monthly'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "gst_filing_frequency"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."users_gst_filing_frequency_enum"`,
    );
  }
}
