import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappChatTables1800000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "whatsapp_conversations_status_enum" AS ENUM (
        'ai_handling',
        'staff_takeover',
        'escalated',
        'closed'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "whatsapp_messages_direction_enum" AS ENUM (
        'inbound',
        'outbound'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "whatsapp_messages_sender_enum" AS ENUM (
        'client',
        'ai',
        'staff'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "whatsapp_messages_message_type_enum" AS ENUM (
        'text',
        'image',
        'document',
        'audio',
        'template',
        'interactive'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "whatsapp_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phone_number" character varying(32) NOT NULL,
        "client_name" character varying(150),
        "business_name" character varying(200),
        "gstin" character varying(20),
        "verified" boolean NOT NULL DEFAULT false,
        "status" "whatsapp_conversations_status_enum" NOT NULL DEFAULT 'ai_handling',
        "assigned_staff_id" uuid,
        "internal_notes" text,
        "unread_count" integer NOT NULL DEFAULT 0,
        "last_message_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_conversations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_whatsapp_conversations_phone_number" ON "whatsapp_conversations" ("phone_number")
    `);

    await queryRunner.query(`
      CREATE TABLE "whatsapp_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "meta_message_id" character varying(150),
        "conversation_id" uuid NOT NULL,
        "direction" "whatsapp_messages_direction_enum" NOT NULL,
        "sender" "whatsapp_messages_sender_enum" NOT NULL,
        "message_type" "whatsapp_messages_message_type_enum" NOT NULL DEFAULT 'text',
        "body" text,
        "media_url" character varying(1000),
        "template_name" character varying(100),
        "staff_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_whatsapp_messages_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_whatsapp_messages_meta_message_id"
      ON "whatsapp_messages" ("meta_message_id")
      WHERE meta_message_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_whatsapp_messages_conversation_id" ON "whatsapp_messages" ("conversation_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_conversations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_messages_message_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_messages_sender_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_messages_direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_conversations_status_enum"`);
  }
}
