import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_SERVICES } from '../../services-offered/default-services';

/**
 * Service catalogue managed from the admin panel:
 * - services: slug (URL key for the client app), tags, icon colour,
 *   markdown detail page (body_md) and an optional per-service contact number.
 * - app_settings: small key/value store (firm-wide contact numbers for the
 *   Call / WhatsApp buttons).
 * - seeds the firm's 8 standard services with starter content. Existing rows
 *   with the same title are adopted (slug/tags/body filled in, nothing
 *   overwritten that staff already wrote).
 */
export class ServiceCatalogue1800000000004 implements MigrationInterface {
  name = 'ServiceCatalogue1800000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "slug" character varying(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "body_md" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "icon_color" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "contact_phone" character varying(20)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "key" character varying(100) PRIMARY KEY,
        "value" jsonb NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    for (const [index, s] of DEFAULT_SERVICES.entries()) {
      const existing = (await queryRunner.query(
        `SELECT "id" FROM "services" WHERE "slug" = $1 OR lower("title") = lower($2) LIMIT 1`,
        [s.slug, s.title],
      )) as Array<{ id: string }>;
      if (existing.length > 0) {
        await queryRunner.query(
          `UPDATE "services" SET
             "slug" = COALESCE("slug", $2),
             "icon" = COALESCE("icon", $3),
             "icon_color" = COALESCE("icon_color", $4),
             "tags" = CASE WHEN "tags" = '[]'::jsonb THEN $5::jsonb ELSE "tags" END,
             "body_md" = CASE WHEN "body_md" = '' THEN $6 ELSE "body_md" END
           WHERE "id" = $1`,
          [
            existing[0].id,
            s.slug,
            s.icon,
            s.icon_color,
            JSON.stringify(s.tags),
            s.body_md,
          ],
        );
      } else {
        await queryRunner.query(
          `INSERT INTO "services"
             ("title", "description", "icon", "icon_color", "tags", "body_md", "slug", "display_order", "is_active")
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, true)`,
          [
            s.title,
            s.description,
            s.icon,
            s.icon_color,
            JSON.stringify(s.tags),
            s.body_md,
            s.slug,
            index,
          ],
        );
      }
    }

    // Any other pre-existing rows get a slug from their title + id prefix
    await queryRunner.query(`
      UPDATE "services"
      SET "slug" = trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'))
                   || '-' || substr("id"::text, 1, 6)
      WHERE "slug" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "services" ALTER COLUMN "slug" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_services_slug" ON "services" ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_services_slug"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_settings"`);
    for (const column of [
      'contact_phone',
      'icon_color',
      'body_md',
      'tags',
      'slug',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "services" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }
}
