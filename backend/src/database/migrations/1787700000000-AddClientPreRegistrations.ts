import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientPreRegistrations1787700000000
  implements MigrationInterface
{
  name = 'AddClientPreRegistrations1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "client_pre_registrations_user_type_enum" AS ENUM ('gst', 'itr')
    `);
    await queryRunner.query(`
      CREATE TABLE "client_pre_registrations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(120) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(20),
        "gstin" VARCHAR(15),
        "user_type" "client_pre_registrations_user_type_enum" NOT NULL DEFAULT 'gst',
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "linked_user_id" VARCHAR(36),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_client_pre_reg_email" ON "client_pre_registrations" ("email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_client_pre_reg_gstin" ON "client_pre_registrations" ("gstin") WHERE "gstin" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "client_pre_registrations"`);
    await queryRunner.query(
      `DROP TYPE "client_pre_registrations_user_type_enum"`,
    );
  }
}
