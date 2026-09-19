import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportShareLinks1796000000006 implements MigrationInterface {
  name = 'CreateReportShareLinks1796000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "report_share_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "report_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8f7a9b0c1d2e3f4a5b6c7d8e9f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_token_hash" ON "report_share_links" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a8b0c1d2e3f4a5b6c7d8e9f0" ON "report_share_links" ("report_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0b9a1c2d3e4f5a6b7c8d9e0a1" ON "report_share_links" ("expires_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "report_share_links" ADD CONSTRAINT "FK_1c0a2d3e4f5a6b7c8d9e0a1b2c" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_share_links" DROP CONSTRAINT "FK_1c0a2d3e4f5a6b7c8d9e0a1b2c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0b9a1c2d3e4f5a6b7c8d9e0a1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a8b0c1d2e3f4a5b6c7d8e9f0"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_token_hash"`);
    await queryRunner.query(`DROP TABLE "report_share_links"`);
  }
}
