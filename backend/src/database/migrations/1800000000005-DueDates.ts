import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DEFAULT_DUE_DATES,
  DUE_DATES_FY,
} from '../../due-dates/default-due-dates';

/**
 * Due date calendar managed from the admin panel, seeded with the FY 2026-27
 * statutory deadlines (GST, income tax / advance tax, TDS / TCS).
 */
export class DueDates1800000000005 implements MigrationInterface {
  name = 'DueDates1800000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "due_dates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" character varying(200) NOT NULL,
        "form" character varying(60),
        "category" character varying(20) NOT NULL,
        "due_date" date NOT NULL,
        "original_due_date" date,
        "period_label" character varying(60),
        "description" text NOT NULL DEFAULT '',
        "audiences" jsonb NOT NULL DEFAULT '["all"]',
        "fy" character varying(9) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_due_dates_fy_date" ON "due_dates" ("fy", "due_date")`,
    );

    const [{ count }] = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "due_dates" WHERE "fy" = $1`,
      [DUE_DATES_FY],
    )) as Array<{ count: number }>;
    if (count > 0) return;

    for (const d of DEFAULT_DUE_DATES) {
      await queryRunner.query(
        `INSERT INTO "due_dates"
           ("title", "form", "category", "due_date", "original_due_date", "period_label", "description", "audiences", "fy")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          d.title,
          d.form,
          d.category,
          d.due_date,
          d.original_due_date ?? null,
          d.period_label,
          d.description,
          JSON.stringify(d.audiences),
          DUE_DATES_FY,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "due_dates"`);
  }
}
