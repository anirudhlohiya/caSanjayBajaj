import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - compliance_tasks: "return filed" tracking (filed_at, ARN, optional filed
 *   report PDF, who filed it, when the last manual payment reminder went out).
 * - whatsapp_conversations.pending_upload: files received over WhatsApp that
 *   the bot is still asking the client to classify (GST month / ITR / other).
 * - whatsapp_messages.media_filename: original filename for admin display.
 */
export class AddFilingAndWhatsappUploads1800000000003 implements MigrationInterface {
  name = 'AddFilingAndWhatsappUploads1800000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ADD COLUMN IF NOT EXISTS "filed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ADD COLUMN IF NOT EXISTS "arn" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ADD COLUMN IF NOT EXISTS "filed_report_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ADD COLUMN IF NOT EXISTS "filed_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" ADD COLUMN IF NOT EXISTS "payment_reminder_sent_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "compliance_tasks"
          ADD CONSTRAINT "fk_compliance_tasks_filed_report"
          FOREIGN KEY ("filed_report_id") REFERENCES "reports"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "whatsapp_conversations" ADD COLUMN IF NOT EXISTS "pending_upload" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_messages" ADD COLUMN IF NOT EXISTS "media_filename" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "whatsapp_messages" DROP COLUMN IF EXISTS "media_filename"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_conversations" DROP COLUMN IF EXISTS "pending_upload"`,
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_tasks" DROP CONSTRAINT IF EXISTS "fk_compliance_tasks_filed_report"`,
    );
    for (const col of [
      'payment_reminder_sent_at',
      'filed_by',
      'filed_report_id',
      'arn',
      'filed_at',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "compliance_tasks" DROP COLUMN IF EXISTS "${col}"`,
      );
    }
  }
}
