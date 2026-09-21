import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreRegFilingFrequency1789812162052 implements MigrationInterface {
  name = 'PreRegFilingFrequency1789812162052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."client_pre_registrations_gst_filing_frequency_enum" AS ENUM('monthly', 'quarterly')`,
    );
    await queryRunner.query(
      `ALTER TABLE "client_pre_registrations" ADD "gst_filing_frequency" "public"."client_pre_registrations_gst_filing_frequency_enum" NOT NULL DEFAULT 'monthly'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "client_pre_registrations" DROP COLUMN "gst_filing_frequency"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."client_pre_registrations_gst_filing_frequency_enum"`,
    );
  }
}
