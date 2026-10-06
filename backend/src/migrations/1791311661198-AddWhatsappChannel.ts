import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWhatsappChannel1791311661198 implements MigrationInterface {
    name = 'AddWhatsappChannel1791311661198'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "client_certificates" DROP CONSTRAINT "FK_5a1f2e3d4c5b6a7f8e9d0c1b2a"`);
        await queryRunner.query(`ALTER TABLE "report_requests" DROP CONSTRAINT "FK_7e6f8a9b0c1d2e3f4a5b6c7d8e"`);
        await queryRunner.query(`ALTER TABLE "report_requests" DROP CONSTRAINT "FK_6d5f7e8a9b0c1d2e3f4a5b6c7d"`);
        await queryRunner.query(`ALTER TABLE "report_requests" DROP CONSTRAINT "FK_5c4f6e7d8a9b0c1d2e3f4d5e6f"`);
        await queryRunner.query(`ALTER TABLE "report_share_links" DROP CONSTRAINT "FK_1c0a2d3e4f5a6b7c8d9e0a1b2c"`);
        await queryRunner.query(`ALTER TABLE "ticket_attachments" DROP CONSTRAINT "fk_ticket_attachments_message"`);
        await queryRunner.query(`ALTER TABLE "ticket_messages" DROP CONSTRAINT "fk_ticket_messages_ticket"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "fk_tickets_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a1f2e3d4c5b6a7f8e9d0c1b2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2f1e3d4c5b6a7c8d9e0f1a2b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3a2f4e5d6c7b8a9d0e1f2b3c4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4b3f5e6d7c8a9b0d1e2f3c4d5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_token_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a8b0c1d2e3f4a5b6c7d8e9f0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b9a1c2d3e4f5a6b7c8d9e0a1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ticket_messages_ticket_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_status"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "user_type" SET DEFAULT 'normal'`);
        await queryRunner.query(`ALTER TYPE "public"."reminders_channel_enum" ADD VALUE 'whatsapp'`);
        await queryRunner.query(`CREATE INDEX "IDX_6b22c7b2a99ba8b3b4e1af44b4" ON "client_certificates"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f1b9b02812af3685a24c594c07" ON "client_certificates"  ("uploaded_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b22c7b2a99ba8b3b4e1af44b4" ON "client_certificates"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_948c54b90eb9069f6c679b404f" ON "report_requests"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e128b407f514634611dedac88" ON "report_requests"  ("filing_period_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ce2a2cc297ecc5469469718f21" ON "report_requests"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b42dcd3848bce1fd3c09e0efa" ON "report_share_links"  ("report_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_036455e0a77fc4645ec0e799d1" ON "report_share_links"  ("token_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_0fafa2e147af62ea23f6e4c8ca" ON "report_share_links"  ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_2e445270177206a97921e46171" ON "tickets"  ("user_id") `);
        await queryRunner.query(`ALTER TABLE "client_certificates" ADD CONSTRAINT "FK_6b22c7b2a99ba8b3b4e1af44b41" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_requests" ADD CONSTRAINT "FK_948c54b90eb9069f6c679b404fc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_requests" ADD CONSTRAINT "FK_8e128b407f514634611dedac880" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_requests" ADD CONSTRAINT "FK_18cdaa1189dce6feaddab2c44c6" FOREIGN KEY ("fulfilled_report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_share_links" ADD CONSTRAINT "FK_6b42dcd3848bce1fd3c09e0efae" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_attachments" ADD CONSTRAINT "FK_a78eb80e865e5bd3ef494b68f78" FOREIGN KEY ("ticket_message_id") REFERENCES "ticket_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_messages" ADD CONSTRAINT "FK_75b3a5f421dbf7b73778da519cb" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_2e445270177206a97921e461710" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_2e445270177206a97921e461710"`);
        await queryRunner.query(`ALTER TABLE "ticket_messages" DROP CONSTRAINT "FK_75b3a5f421dbf7b73778da519cb"`);
        await queryRunner.query(`ALTER TABLE "ticket_attachments" DROP CONSTRAINT "FK_a78eb80e865e5bd3ef494b68f78"`);
        await queryRunner.query(`ALTER TABLE "report_share_links" DROP CONSTRAINT "FK_6b42dcd3848bce1fd3c09e0efae"`);
        await queryRunner.query(`ALTER TABLE "report_requests" DROP CONSTRAINT "FK_18cdaa1189dce6feaddab2c44c6"`);
        await queryRunner.query(`ALTER TABLE "report_requests" DROP CONSTRAINT "FK_8e128b407f514634611dedac880"`);
        await queryRunner.query(`ALTER TABLE "report_requests" DROP CONSTRAINT "FK_948c54b90eb9069f6c679b404fc"`);
        await queryRunner.query(`ALTER TABLE "client_certificates" DROP CONSTRAINT "FK_6b22c7b2a99ba8b3b4e1af44b41"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e445270177206a97921e46171"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0fafa2e147af62ea23f6e4c8ca"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_036455e0a77fc4645ec0e799d1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b42dcd3848bce1fd3c09e0efa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ce2a2cc297ecc5469469718f21"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e128b407f514634611dedac88"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_948c54b90eb9069f6c679b404f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b22c7b2a99ba8b3b4e1af44b4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1b9b02812af3685a24c594c07"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b22c7b2a99ba8b3b4e1af44b4"`);
        await queryRunner.query(`CREATE TYPE "public"."reminders_channel_enum_old" AS ENUM('push', 'email')`);
        await queryRunner.query(`ALTER TABLE "reminders" ALTER COLUMN "channel" TYPE "public"."reminders_channel_enum_old" USING "channel"::"text"::"public"."reminders_channel_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."reminders_channel_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."reminders_channel_enum_old" RENAME TO "reminders_channel_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "user_type" SET DEFAULT 'gst'`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_status" ON "tickets" USING btree ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_user_id" ON "tickets" USING btree ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ticket_messages_ticket_id" ON "ticket_messages" USING btree ("ticket_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0b9a1c2d3e4f5a6b7c8d9e0a1" ON "report_share_links" USING btree ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_9a8b0c1d2e3f4a5b6c7d8e9f0" ON "report_share_links" USING btree ("report_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_token_hash" ON "report_share_links" USING btree ("token_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b3f5e6d7c8a9b0d1e2f3c4d5" ON "report_requests" USING btree ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_3a2f4e5d6c7b8a9d0e1f2b3c4" ON "report_requests" USING btree ("filing_period_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2f1e3d4c5b6a7c8d9e0f1a2b3" ON "report_requests" USING btree ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a1f2e3d4c5b6a7f8e9d0c1b2" ON "client_certificates" USING btree ("user_id") `);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "fk_tickets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_messages" ADD CONSTRAINT "fk_ticket_messages_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_attachments" ADD CONSTRAINT "fk_ticket_attachments_message" FOREIGN KEY ("ticket_message_id") REFERENCES "ticket_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_share_links" ADD CONSTRAINT "FK_1c0a2d3e4f5a6b7c8d9e0a1b2c" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_requests" ADD CONSTRAINT "FK_5c4f6e7d8a9b0c1d2e3f4d5e6f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_requests" ADD CONSTRAINT "FK_6d5f7e8a9b0c1d2e3f4a5b6c7d" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_requests" ADD CONSTRAINT "FK_7e6f8a9b0c1d2e3f4a5b6c7d8e" FOREIGN KEY ("fulfilled_report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "client_certificates" ADD CONSTRAINT "FK_5a1f2e3d4c5b6a7f8e9d0c1b2a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
