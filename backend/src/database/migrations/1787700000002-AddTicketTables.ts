import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketTables1787700000002 implements MigrationInterface {
  name = 'AddTicketTables1787700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tickets_status_enum" AS ENUM ('open', 'replied', 'closed')
    `);
    await queryRunner.query(`
      CREATE TYPE "tickets_category_enum" AS ENUM ('document_request', 'general', 'complaint', 'other')
    `);
    await queryRunner.query(`
      CREATE TYPE "tickets_priority_enum" AS ENUM ('low', 'medium', 'high')
    `);
    await queryRunner.query(`
      CREATE TYPE "ticket_messages_sender_type_enum" AS ENUM ('user', 'admin')
    `);

    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "subject" VARCHAR(255) NOT NULL,
        "category" "tickets_category_enum" NOT NULL DEFAULT 'general',
        "status" "tickets_status_enum" NOT NULL DEFAULT 'open',
        "priority" "tickets_priority_enum" NOT NULL DEFAULT 'medium',
        "closed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_tickets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_user_id" ON "tickets" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_status" ON "tickets" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "ticket_messages" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "ticket_id" UUID NOT NULL,
        "sender_type" "ticket_messages_sender_type_enum" NOT NULL,
        "sender_id" VARCHAR(36) NOT NULL,
        "message" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_ticket_messages_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_messages_ticket_id" ON "ticket_messages" ("ticket_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "ticket_attachments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "ticket_message_id" UUID NOT NULL,
        "s3_key" VARCHAR(500) NOT NULL,
        "original_filename" VARCHAR(255) NOT NULL,
        "file_size_bytes" BIGINT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_ticket_attachments_message" FOREIGN KEY ("ticket_message_id") REFERENCES "ticket_messages"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ticket_attachments"`);
    await queryRunner.query(`DROP TABLE "ticket_messages"`);
    await queryRunner.query(`DROP TABLE "tickets"`);
    await queryRunner.query(`DROP TYPE "ticket_messages_sender_type_enum"`);
    await queryRunner.query(`DROP TYPE "tickets_priority_enum"`);
    await queryRunner.query(`DROP TYPE "tickets_category_enum"`);
    await queryRunner.query(`DROP TYPE "tickets_status_enum"`);
  }
}
