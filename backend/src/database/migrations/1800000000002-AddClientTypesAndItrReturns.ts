import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientTypesAndItrReturns1800000000002
  implements MigrationInterface
{
  name = 'AddClientTypesAndItrReturns1800000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add 'general' and 'both' to user_type enums
    await queryRunner.query(
      `ALTER TYPE "public"."users_user_type_enum" ADD VALUE IF NOT EXISTS 'general'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."users_user_type_enum" ADD VALUE IF NOT EXISTS 'both'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."client_pre_registrations_user_type_enum" ADD VALUE IF NOT EXISTS 'general'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."client_pre_registrations_user_type_enum" ADD VALUE IF NOT EXISTS 'both'`,
    );

    // Commit and restart transaction to allow newly added enum values to be used
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();

    // 2. Add columns to users table and set default user_type
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "industry" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pan" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "user_type" SET DEFAULT 'general'`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "user_type" = 'general' WHERE "user_type" = 'normal'`,
    );

    // 3. Create service_requests table & enums
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "public"."service_request_type_enum" AS ENUM('gst', 'itr', 'both');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "public"."service_request_status_enum" AS ENUM('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "service_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "requested_type" "public"."service_request_type_enum" NOT NULL,
        "status" "public"."service_request_status_enum" NOT NULL DEFAULT 'pending',
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_service_requests_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_service_requests_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "admins"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_service_requests_user_id" ON "service_requests" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_service_requests_status" ON "service_requests" ("status")`,
    );

    // 4. Update documents table (category enum, nullable filing_period_id, assessment_year)
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "public"."documents_category_enum" AS ENUM('gst', 'itr', 'general');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "category" "public"."documents_category_enum" NOT NULL DEFAULT 'gst'`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "filing_period_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "assessment_year" character varying(20)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_documents_category" ON "documents" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_documents_user_id_category" ON "documents" ("user_id", "category")`,
    );

    // 5. Create itr_returns table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "itr_returns" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "assessment_year" character varying(20) NOT NULL,
        "s3_key" character varying(500) NOT NULL,
        "original_filename" character varying(255) NOT NULL,
        "file_size_bytes" bigint NOT NULL,
        "uploaded_by" uuid,
        "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_itr_returns_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_itr_returns_user_ay" UNIQUE ("user_id", "assessment_year"),
        CONSTRAINT "FK_itr_returns_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itr_returns_uploaded_by" FOREIGN KEY ("uploaded_by") REFERENCES "admins"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itr_returns_user_id" ON "itr_returns" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "itr_returns"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_documents_user_id_category"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_category"`);
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "assessment_year"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "category"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "documents_category_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_requests"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "service_request_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "service_request_type_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "pan"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "industry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "business_name"`,
    );
  }
}
