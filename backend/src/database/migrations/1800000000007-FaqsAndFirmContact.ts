import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_FAQS } from '../../faqs/default-faqs';

/**
 * - faqs table for the client app's FAQ page, seeded with starter questions.
 * - Firm contact details (Contact Us / Talk to Expert) pre-filled from the
 *   website: phone, firm WhatsApp Business number, email, office address,
 *   map link and office hours. Values staff have already saved win; only
 *   missing ones are filled in.
 */
export class FaqsAndFirmContact1800000000007 implements MigrationInterface {
  name = 'FaqsAndFirmContact1800000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "faqs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "category" character varying(20) NOT NULL,
        "question" character varying(300) NOT NULL,
        "answer_md" text NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    const [{ count }] = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "faqs"`,
    )) as Array<{ count: number }>;
    if (count === 0) {
      for (const [index, f] of DEFAULT_FAQS.entries()) {
        await queryRunner.query(
          `INSERT INTO "faqs" ("category", "question", "answer_md", "display_order")
           VALUES ($1, $2, $3, $4)`,
          [f.category, f.question, f.answer_md, index],
        );
      }
    }

    const defaults = {
      phone: '+91 99098 31995',
      whatsapp: '+91 78783 98067',
      email: 'casnbajaj2015@gmail.com',
      address:
        '2007, Trade House, Opp. Man Darwaja Fire Station, Ring Road, Surat - 395002, Gujarat',
      map_url: 'https://maps.app.goo.gl/4NhEy5wMpAyFHKyd6',
      open_from: '10:00',
      open_to: '19:00',
      open_days: [1, 2, 3, 4, 5, 6],
    };
    // defaults || saved values (nulls stripped) — anything staff set is kept
    await queryRunner.query(
      `INSERT INTO "app_settings" ("key", "value") VALUES ('services.contact', $1::jsonb)
       ON CONFLICT ("key") DO UPDATE
         SET "value" = $1::jsonb || jsonb_strip_nulls("app_settings"."value"),
             "updated_at" = now()`,
      [JSON.stringify(defaults)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "faqs"`);
  }
}
