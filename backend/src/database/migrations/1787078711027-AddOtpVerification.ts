import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpVerification1787078711027 implements MigrationInterface {
  name = 'AddOtpVerification1787078711027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "fk_audit_admin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "fk_audit_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "fk_audit_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "fk_device_tokens_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "fk_documents_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "fk_documents_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT "fk_permissions_admin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP CONSTRAINT "fk_reminders_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP CONSTRAINT "fk_reminders_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "fk_reports_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "fk_reports_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "fk_reports_admin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_notifications" DROP CONSTRAINT "fk_report_notifications_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_admins_email"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_gst_filing_periods_code"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_users_email"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_user_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_admin_time"`);
    await queryRunner.query(`DROP INDEX "public"."idx_device_tokens_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_documents_user_period"`);
    await queryRunner.query(`DROP INDEX "public"."idx_documents_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_documents_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_permissions_admin"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_subject"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reminders_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reminders_period"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_user_period"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_report_notifications_user_read"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "uq_device_tokens_user_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT "uq_permissions_admin_key"`,
    );
    await queryRunner.query(
      `CREATE TABLE "otp_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "otp_code" character varying(6) NOT NULL, "purpose" character varying(30) NOT NULL, "verified" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_91d17e75ac3182dba6701869b39" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."admin_role_enum" RENAME TO "admin_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."admins_role_enum" AS ENUM('super_admin', 'staff')`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "role" TYPE "public"."admins_role_enum" USING "role"::"text"::"public"."admins_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'staff'`,
    );
    await queryRunner.query(`DROP TYPE "public"."admin_role_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."admin_status_enum" RENAME TO "admin_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."admins_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "status" TYPE "public"."admins_status_enum" USING "status"::"text"::"public"."admins_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "public"."admin_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_type_enum" RENAME TO "user_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_user_type_enum" AS ENUM('gst', 'itr')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "user_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "user_type" TYPE "public"."users_user_type_enum" USING "user_type"::"text"::"public"."users_user_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "user_type" SET DEFAULT 'gst'`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_status_enum" RENAME TO "user_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum" USING "status"::"text"::"public"."users_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."device_platform_enum" RENAME TO "device_platform_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."device_tokens_platform_enum" AS ENUM('pwa', 'android')`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ALTER COLUMN "platform" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ALTER COLUMN "platform" TYPE "public"."device_tokens_platform_enum" USING "platform"::"text"::"public"."device_tokens_platform_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ALTER COLUMN "platform" SET DEFAULT 'pwa'`,
    );
    await queryRunner.query(`DROP TYPE "public"."device_platform_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."document_file_type_enum" RENAME TO "document_file_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."documents_file_type_enum" AS ENUM('pdf', 'image', 'excel')`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "file_type" TYPE "public"."documents_file_type_enum" USING "file_type"::"text"::"public"."documents_file_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."document_file_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."document_status_enum" RENAME TO "document_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."documents_status_enum" AS ENUM('pending', 'received', 'processed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "status" TYPE "public"."documents_status_enum" USING "status"::"text"::"public"."documents_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."document_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."subject_type_enum" RENAME TO "subject_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."refresh_tokens_subject_type_enum" AS ENUM('user', 'admin')`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ALTER COLUMN "subject_type" TYPE "public"."refresh_tokens_subject_type_enum" USING "subject_type"::"text"::"public"."refresh_tokens_subject_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."subject_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."reminder_channel_enum" RENAME TO "reminder_channel_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reminders_channel_enum" AS ENUM('push', 'email')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ALTER COLUMN "channel" TYPE "public"."reminders_channel_enum" USING "channel"::"text"::"public"."reminders_channel_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."reminder_channel_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."reminder_status_enum" RENAME TO "reminder_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reminders_status_enum" AS ENUM('queued', 'sent', 'failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ALTER COLUMN "status" TYPE "public"."reminders_status_enum" USING "status"::"text"::"public"."reminders_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ALTER COLUMN "status" SET DEFAULT 'queued'`,
    );
    await queryRunner.query(`DROP TYPE "public"."reminder_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."report_type_enum" RENAME TO "report_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_report_type_enum" AS ENUM('gstr_1', 'gstr_3b', 'reconciliation', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "report_type" TYPE "public"."reports_report_type_enum" USING "report_type"::"text"::"public"."reports_report_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."report_type_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_051db7d37d478a69a7432df147" ON "admins"  ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4e5a518ddf1a0d4c40ed2a116a" ON "gst_filing_periods"  ("period_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88edc3fe51c9b0bad5388037e2" ON "audit_logs"  ("admin_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_17e1f528b993c6d55def4cf5be" ON "device_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c7481daf5059307842edef74d7" ON "documents"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_709389d904fa03bdf5ec84998d" ON "documents"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6e233090227197d8952a69a0c4" ON "documents"  ("user_id", "filing_period_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2bce219c0d262b3782c77f3798" ON "permissions"  ("admin_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cbf091e35998010a409b275b61" ON "refresh_tokens"  ("subject_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_586e0b8e419125be507701cee2" ON "reminders"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c37fc9fa182b38a62bcf43584a" ON "reminders"  ("filing_period_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ca7a21eb95ca4625bd5eaef7e0" ON "reports"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad017c186f0869af9ab58c1ced" ON "reports"  ("user_id", "filing_period_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_540c52cc7b79d984e57b5d2359" ON "report_notifications"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bb5c18a5983ba878f5c0133743" ON "report_notifications"  ("user_id", "is_read") `,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "UQ_bf59c55195f21b4f7892b306484" UNIQUE ("user_id", "push_token")`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "UQ_5a761af9da005d074fcc5f08871" UNIQUE ("admin_id", "permission_key")`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_b29de603374cbfa7d776d88e5b5" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_c49454aef596e6f9dc3eb64f3c6" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_4e569f35445c80361b03ba34ee3" FOREIGN KEY ("target_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_c7481daf5059307842edef74d73" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_f8124b2caaa9b11dcf53e84821e" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "FK_2bce219c0d262b3782c77f3798e" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "FK_586e0b8e419125be507701cee2a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "FK_c37fc9fa182b38a62bcf43584ad" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_ca7a21eb95ca4625bd5eaef7e0c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_d88d63e2ec0885fdc99df3db890" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_bd7b62331688eddad773bccbeef" FOREIGN KEY ("sent_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_notifications" ADD CONSTRAINT "FK_540c52cc7b79d984e57b5d23591" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_notifications" DROP CONSTRAINT "FK_540c52cc7b79d984e57b5d23591"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_bd7b62331688eddad773bccbeef"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_d88d63e2ec0885fdc99df3db890"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_ca7a21eb95ca4625bd5eaef7e0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP CONSTRAINT "FK_c37fc9fa182b38a62bcf43584ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP CONSTRAINT "FK_586e0b8e419125be507701cee2a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT "FK_2bce219c0d262b3782c77f3798e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_f8124b2caaa9b11dcf53e84821e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_c7481daf5059307842edef74d73"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_4e569f35445c80361b03ba34ee3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_c49454aef596e6f9dc3eb64f3c6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_b29de603374cbfa7d776d88e5b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT "UQ_5a761af9da005d074fcc5f08871"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "UQ_bf59c55195f21b4f7892b306484"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb5c18a5983ba878f5c0133743"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_540c52cc7b79d984e57b5d2359"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad017c186f0869af9ab58c1ced"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ca7a21eb95ca4625bd5eaef7e0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c37fc9fa182b38a62bcf43584a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_586e0b8e419125be507701cee2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cbf091e35998010a409b275b61"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2bce219c0d262b3782c77f3798"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6e233090227197d8952a69a0c4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_709389d904fa03bdf5ec84998d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c7481daf5059307842edef74d7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_17e1f528b993c6d55def4cf5be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_88edc3fe51c9b0bad5388037e2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4e5a518ddf1a0d4c40ed2a116a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_051db7d37d478a69a7432df147"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_type_enum_old" AS ENUM('gstr_1', 'gstr_3b', 'reconciliation', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "report_type" TYPE "public"."report_type_enum_old" USING "report_type"::"text"::"public"."report_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."reports_report_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."report_type_enum_old" RENAME TO "report_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reminder_status_enum_old" AS ENUM('queued', 'sent', 'failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ALTER COLUMN "status" TYPE "public"."reminder_status_enum_old" USING "status"::"text"::"public"."reminder_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ALTER COLUMN "status" SET DEFAULT 'queued'`,
    );
    await queryRunner.query(`DROP TYPE "public"."reminders_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."reminder_status_enum_old" RENAME TO "reminder_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reminder_channel_enum_old" AS ENUM('push', 'email')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ALTER COLUMN "channel" TYPE "public"."reminder_channel_enum_old" USING "channel"::"text"::"public"."reminder_channel_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."reminders_channel_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."reminder_channel_enum_old" RENAME TO "reminder_channel_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subject_type_enum_old" AS ENUM('user', 'admin')`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ALTER COLUMN "subject_type" TYPE "public"."subject_type_enum_old" USING "subject_type"::"text"::"public"."subject_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."refresh_tokens_subject_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."subject_type_enum_old" RENAME TO "subject_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_status_enum_old" AS ENUM('pending', 'received', 'processed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "status" TYPE "public"."document_status_enum_old" USING "status"::"text"::"public"."document_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."documents_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."document_status_enum_old" RENAME TO "document_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_file_type_enum_old" AS ENUM('pdf', 'image', 'excel')`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "file_type" TYPE "public"."document_file_type_enum_old" USING "file_type"::"text"::"public"."document_file_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."documents_file_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."document_file_type_enum_old" RENAME TO "document_file_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."device_platform_enum_old" AS ENUM('pwa', 'android')`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ALTER COLUMN "platform" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ALTER COLUMN "platform" TYPE "public"."device_platform_enum_old" USING "platform"::"text"::"public"."device_platform_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ALTER COLUMN "platform" SET DEFAULT 'pwa'`,
    );
    await queryRunner.query(`DROP TYPE "public"."device_tokens_platform_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."device_platform_enum_old" RENAME TO "device_platform_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status_enum_old" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."user_status_enum_old" USING "status"::"text"::"public"."user_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_status_enum_old" RENAME TO "user_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_type_enum_old" AS ENUM('gst', 'itr')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "user_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "user_type" TYPE "public"."user_type_enum_old" USING "user_type"::"text"::"public"."user_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "user_type" SET DEFAULT 'gst'`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_user_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_type_enum_old" RENAME TO "user_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."admin_status_enum_old" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "status" TYPE "public"."admin_status_enum_old" USING "status"::"text"::"public"."admin_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "public"."admins_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."admin_status_enum_old" RENAME TO "admin_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."admin_role_enum_old" AS ENUM('super_admin', 'staff')`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "role" TYPE "public"."admin_role_enum_old" USING "role"::"text"::"public"."admin_role_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'staff'`,
    );
    await queryRunner.query(`DROP TYPE "public"."admins_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."admin_role_enum_old" RENAME TO "admin_role_enum"`,
    );
    await queryRunner.query(`DROP TABLE "otp_verifications"`);
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "uq_permissions_admin_key" UNIQUE ("admin_id", "permission_key")`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "uq_device_tokens_user_token" UNIQUE ("user_id", "push_token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_report_notifications_user_read" ON "report_notifications" USING btree ("user_id", "is_read") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_user_id" ON "reports" USING btree ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_user_period" ON "reports" USING btree ("user_id", "filing_period_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reminders_period" ON "reminders" USING btree ("filing_period_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reminders_user" ON "reminders" USING btree ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_subject" ON "refresh_tokens" USING btree ("subject_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_permissions_admin" ON "permissions" USING btree ("admin_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_documents_user_id" ON "documents" USING btree ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_documents_status" ON "documents" USING btree ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_documents_user_period" ON "documents" USING btree ("user_id", "filing_period_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_device_tokens_user" ON "device_tokens" USING btree ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_admin_time" ON "audit_logs" USING btree ("admin_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_user_type" ON "users" USING btree ("user_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_email" ON "users" USING btree ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_gst_filing_periods_code" ON "gst_filing_periods" USING btree ("period_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_admins_email" ON "admins" USING btree ("email") `,
    );
    await queryRunner.query(
      `ALTER TABLE "report_notifications" ADD CONSTRAINT "fk_report_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_admin" FOREIGN KEY ("sent_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_period" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "fk_reminders_period" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "fk_reminders_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "fk_permissions_admin" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_period" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "fk_device_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_period" FOREIGN KEY ("target_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_user" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_admin" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
