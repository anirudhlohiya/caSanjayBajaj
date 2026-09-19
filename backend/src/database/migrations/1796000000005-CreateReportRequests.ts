import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportRequests1796000000005 implements MigrationInterface {
  name = 'CreateReportRequests1796000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."report_requests_status_enum" AS ENUM('pending', 'fulfilled', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "filing_period_id" uuid NOT NULL, "status" "public"."report_requests_status_enum" NOT NULL, "fulfilled_report_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fulfilled_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6c4a5d1e2f3a4b5c6d7e8f9a0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f1e3d4c5b6a7c8d9e0f1a2b3" ON "report_requests" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3a2f4e5d6c7b8a9d0e1f2b3c4" ON "report_requests" ("filing_period_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4b3f5e6d7c8a9b0d1e2f3c4d5" ON "report_requests" ("status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "report_requests" ADD CONSTRAINT "FK_5c4f6e7d8a9b0c1d2e3f4d5e6f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_requests" ADD CONSTRAINT "FK_6d5f7e8a9b0c1d2e3f4a5b6c7d" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_requests" ADD CONSTRAINT "FK_7e6f8a9b0c1d2e3f4a5b6c7d8e" FOREIGN KEY ("fulfilled_report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_requests" DROP CONSTRAINT "FK_7e6f8a9b0c1d2e3f4a5b6c7d8e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_requests" DROP CONSTRAINT "FK_6d5f7e8a9b0c1d2e3f4a5b6c7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_requests" DROP CONSTRAINT "FK_5c4f6e7d8a9b0c1d2e3f4d5e6f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4b3f5e6d7c8a9b0d1e2f3c4d5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3a2f4e5d6c7b8a9d0e1f2b3c4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f1e3d4c5b6a7c8d9e0f1a2b3"`,
    );
    await queryRunner.query(`DROP TABLE "report_requests"`);
    await queryRunner.query(`DROP TYPE "public"."report_requests_status_enum"`);
  }
}
