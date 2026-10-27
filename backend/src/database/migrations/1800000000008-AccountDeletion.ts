import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Client self-service account deletion (Play Store requirement).
 * - users.deletion_requested_at: set when the client asks; the account is
 *   locked and erased 30 days later unless they sign in again.
 * - users.deleted_at: set once the login and personal details are erased
 *   (tax records stay for the firm).
 */
export class AccountDeletion1800000000008 implements MigrationInterface {
  name = 'AccountDeletion1800000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_deletion_requested_at" ON "users" ("deletion_requested_at") WHERE "deletion_requested_at" IS NOT NULL AND "deleted_at" IS NULL`,
    );

    // whatsapp_conversations.client_id links a chat to its client (the entity
    // has it, and erasing an account deletes those chats) but it was only ever
    // added by a migration outside src/database/migrations, so fresh databases
    // lack it. Add it where missing; servers that already have it are untouched.
    await queryRunner.query(
      `ALTER TABLE "whatsapp_conversations" ADD COLUMN IF NOT EXISTS "client_id" uuid`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_whatsapp_conversations_client_id'
        ) THEN
          ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "FK_whatsapp_conversations_client_id"
            FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_whatsapp_conversations_client_id" ON "whatsapp_conversations" ("client_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_deletion_requested_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "deletion_requested_at"`,
    );
  }
}
