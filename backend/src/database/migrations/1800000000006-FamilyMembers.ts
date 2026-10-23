import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Family members on a client account (account holder + up to 5 members), so
 * one login can manage ITR for the whole family.
 * - family_members table
 * - itr_returns.family_member_id / documents.family_member_id
 *   (null = the account holder)
 * - one ITR return per person per AY: the old (user_id, assessment_year)
 *   unique constraint becomes an expression index that treats the holder's
 *   null member id as a value.
 */
export class FamilyMembers1800000000006 implements MigrationInterface {
  name = 'FamilyMembers1800000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "family_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" character varying(120) NOT NULL,
        "relation" character varying(20) NOT NULL,
        "pan" character varying(10),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_family_members_user" ON "family_members" ("user_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "itr_returns" ADD COLUMN IF NOT EXISTS "family_member_id" uuid REFERENCES "family_members"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "itr_returns" DROP CONSTRAINT IF EXISTS "UQ_itr_returns_user_ay"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_itr_returns_person_ay" ON "itr_returns" (
        "user_id",
        COALESCE("family_member_id", '00000000-0000-0000-0000-000000000000'::uuid),
        "assessment_year"
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "family_member_id" uuid REFERENCES "family_members"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_documents_family_member" ON "documents" ("family_member_id") WHERE "family_member_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_documents_family_member"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "family_member_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_itr_returns_person_ay"`);
    // Member returns cannot fit the old constraint; drop them before restoring it
    await queryRunner.query(
      `DELETE FROM "itr_returns" WHERE "family_member_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "itr_returns" DROP COLUMN IF EXISTS "family_member_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itr_returns" ADD CONSTRAINT "UQ_itr_returns_user_ay" UNIQUE ("user_id", "assessment_year")`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "family_members"`);
  }
}
