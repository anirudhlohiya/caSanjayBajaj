import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums
    await queryRunner.query(
      `CREATE TYPE "public"."user_type_enum" AS ENUM('gst','itr')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status_enum" AS ENUM('active','inactive')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."admin_role_enum" AS ENUM('super_admin','staff')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."admin_status_enum" AS ENUM('active','inactive')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_file_type_enum" AS ENUM('pdf','image','excel')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_status_enum" AS ENUM('pending','received','processed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_type_enum" AS ENUM('gstr_1','gstr_3b','reconciliation','other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reminder_channel_enum" AS ENUM('push','email')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reminder_status_enum" AS ENUM('queued','sent','failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subject_type_enum" AS ENUM('user','admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."device_platform_enum" AS ENUM('pwa','android')`,
    );

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(120) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "phone" character varying(20),
        "gstin" character varying(15),
        "user_type" "public"."user_type_enum" NOT NULL DEFAULT 'gst',
        "status" "public"."user_status_enum" NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "uq_users_gstin" UNIQUE ("gstin")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_user_type" ON "users" ("user_type")`,
    );

    // admins
    await queryRunner.query(`
      CREATE TABLE "admins" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(120) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "role" "public"."admin_role_enum" NOT NULL DEFAULT 'staff',
        "status" "public"."admin_status_enum" NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_admins" PRIMARY KEY ("id"),
        CONSTRAINT "uq_admins_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_admins_email" ON "admins" ("email")`,
    );

    // permissions
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admin_id" uuid NOT NULL,
        "permission_key" character varying(50) NOT NULL,
        "granted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "pk_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_permissions_admin_key" UNIQUE ("admin_id", "permission_key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_permissions_admin" ON "permissions" ("admin_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "permissions" ADD CONSTRAINT "fk_permissions_admin"
      FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // gst_filing_periods
    await queryRunner.query(`
      CREATE TABLE "gst_filing_periods" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "period_label" character varying(30) NOT NULL,
        "period_code" character varying(7) NOT NULL,
        "due_date" date NOT NULL,
        "is_open" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_gst_filing_periods" PRIMARY KEY ("id"),
        CONSTRAINT "uq_gst_filing_periods_label" UNIQUE ("period_label"),
        CONSTRAINT "uq_gst_filing_periods_code" UNIQUE ("period_code")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_gst_filing_periods_code" ON "gst_filing_periods" ("period_code")`,
    );

    // documents
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "filing_period_id" uuid NOT NULL,
        "s3_key" character varying(500) NOT NULL,
        "original_filename" character varying(255) NOT NULL,
        "file_type" "public"."document_file_type_enum" NOT NULL,
        "file_size_bytes" bigint NOT NULL,
        "status" "public"."document_status_enum" NOT NULL DEFAULT 'pending',
        "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_documents" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_documents_user_period" ON "documents" ("user_id", "filing_period_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_documents_status" ON "documents" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_documents_user_id" ON "documents" ("user_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_period"
      FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // reports
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "filing_period_id" uuid NOT NULL,
        "report_type" "public"."report_type_enum" NOT NULL,
        "s3_key" character varying(500) NOT NULL,
        "original_filename" character varying(255) NOT NULL,
        "sent_by_admin_id" uuid,
        "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reports" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_reports_user_period" ON "reports" ("user_id", "filing_period_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_user_id" ON "reports" ("user_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_period"
      FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_admin"
      FOREIGN KEY ("sent_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // reminders
    await queryRunner.query(`
      CREATE TABLE "reminders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "filing_period_id" uuid NOT NULL,
        "channel" "public"."reminder_channel_enum" NOT NULL,
        "status" "public"."reminder_status_enum" NOT NULL DEFAULT 'queued',
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "triggered_by" character varying(40) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reminders" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_reminders_user" ON "reminders" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reminders_period" ON "reminders" ("filing_period_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "reminders" ADD CONSTRAINT "fk_reminders_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "reminders" ADD CONSTRAINT "fk_reminders_period"
      FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // audit_logs
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admin_id" uuid,
        "action" character varying(100) NOT NULL,
        "target_user_id" uuid,
        "target_period_id" uuid,
        "detail" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_admin_time" ON "audit_logs" ("admin_id", "created_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_admin"
      FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_user"
      FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_period"
      FOREIGN KEY ("target_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // refresh_tokens
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "subject_type" "public"."subject_type_enum" NOT NULL,
        "subject_id" uuid NOT NULL,
        "token_hash" character varying(255) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "uq_refresh_tokens_hash" UNIQUE ("token_hash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_subject" ON "refresh_tokens" ("subject_id")`,
    );

    // device_tokens
    await queryRunner.query(`
      CREATE TABLE "device_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "platform" "public"."device_platform_enum" NOT NULL DEFAULT 'pwa',
        "push_token" character varying(500) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_device_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "uq_device_tokens_user_token" UNIQUE ("user_id", "push_token")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_device_tokens_user" ON "device_tokens" ("user_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "device_tokens" ADD CONSTRAINT "fk_device_tokens_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "device_tokens"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "reminders"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TABLE "gst_filing_periods"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."device_platform_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subject_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reminder_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reminder_channel_enum"`);
    await queryRunner.query(`DROP TYPE "public"."report_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."document_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."document_file_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."admin_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."admin_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_type_enum"`);
  }
}
