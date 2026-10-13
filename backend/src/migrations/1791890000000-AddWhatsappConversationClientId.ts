import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappConversationClientId1791890000000 implements MigrationInterface {
  name = 'AddWhatsappConversationClientId1791890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "whatsapp_conversations" ADD COLUMN IF NOT EXISTS "client_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "FK_whatsapp_conversations_client_id" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_whatsapp_conversations_client_id" ON "whatsapp_conversations" ("client_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_whatsapp_conversations_client_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_conversations" DROP CONSTRAINT IF EXISTS "FK_whatsapp_conversations_client_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_conversations" DROP COLUMN IF EXISTS "client_id"`,
    );
  }
}
