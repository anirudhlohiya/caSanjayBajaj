import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * docs/13 §6.1 #3 — task status gains `nil_declared` (client-initiated nil
 * filing, admin-confirmed), plus `nil_declared_at` and `message_day`
 * (0/1/2 reminder-slot grouping, for reminder dedupe in M2).
 *
 * Postgres enum values are additive-only: `ALTER TYPE ... ADD VALUE` inside a
 * transaction is supported on PostgreSQL 12+ and this migration never uses the
 * new value, so it is safe. Legacy values (`sales_bills` / `purchase_bills`)
 * are deliberately NOT removed from `compliance_tasks_category_enum` — see
 * docs/13 §6.4.
 */
export class ExtendComplianceTask1796000000003 implements MigrationInterface {
  name = 'ExtendComplianceTask1796000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."compliance_tasks_status_enum" ADD VALUE 'nil_declared'`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ADD "nil_declared_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ADD "message_day" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" DROP COLUMN "message_day"`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" DROP COLUMN "nil_declared_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."compliance_tasks_status_enum" RENAME TO "compliance_tasks_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."compliance_tasks_status_enum" AS ENUM('pending', 'uploaded', 'completed')`,
    );
    await queryRunner.query(
      `UPDATE "compliance_tasks" SET "status" = 'completed' WHERE "status" = 'nil_declared'`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ALTER COLUMN "status" TYPE "public"."compliance_tasks_status_enum" USING ("status"::text::"public"."compliance_tasks_status_enum")`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."compliance_tasks_status_enum_old"`,
    );
  }
}
