import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPeriodSchedule1796000000002 implements MigrationInterface {
  name = 'AddPeriodSchedule1796000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gst_filing_periods" ADD "schedule" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gst_filing_periods" DROP COLUMN "schedule"`,
    );
  }
}
