import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClientCertificates1796000000004 implements MigrationInterface {
  name = 'CreateClientCertificates1796000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."client_certificates_cert_type_enum" AS ENUM('gst_cert', 'udyam_cert')`,
    );
    await queryRunner.query(
      `CREATE TABLE "client_certificates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "cert_type" "public"."client_certificates_cert_type_enum" NOT NULL, "s3_key" character varying(500) NOT NULL, "original_filename" character varying(255) NOT NULL, "uploaded_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5b8d3c2a1f0e9d8c7b6a504132" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a1f2e3d4c5b6a7f8e9d0c1b2" ON "client_certificates"  ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "client_certificates" ADD CONSTRAINT "FK_5a1f2e3d4c5b6a7f8e9d0c1b2a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "client_certificates" DROP CONSTRAINT "FK_5a1f2e3d4c5b6a7f8e9d0c1b2a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a1f2e3d4c5b6a7f8e9d0c1b2"`,
    );
    await queryRunner.query(`DROP TABLE "client_certificates"`);
    await queryRunner.query(
      `DROP TYPE "public"."client_certificates_cert_type_enum"`,
    );
  }
}
