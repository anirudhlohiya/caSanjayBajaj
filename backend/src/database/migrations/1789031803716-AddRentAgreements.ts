import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRentAgreements1789031803716 implements MigrationInterface {
    name = 'AddRentAgreements1789031803716'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."rent_agreements_status_enum" AS ENUM('draft', 'generated')`);
        await queryRunner.query(`CREATE TABLE "rent_agreements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "template_id" character varying(100) NOT NULL, "template_version" integer NOT NULL DEFAULT '1', "status" "public"."rent_agreements_status_enum" NOT NULL DEFAULT 'draft', "owner_name" character varying(255), "tenant_name" character varying(255), "property_address" character varying(500), "agreement_start_date" date, "agreement_end_date" date, "form_data" jsonb NOT NULL DEFAULT '{}', "created_by_admin_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3b47b6360e46f92324fe32d8047" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_731f7f347d9011b3f2a4a881e9" ON "rent_agreements"  ("template_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8a6c46e4e1b07f02998684a67" ON "rent_agreements"  ("owner_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_63d54af7d8ed1b94ffdaca1903" ON "rent_agreements"  ("tenant_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_8daa9146815767a728cf1719ba" ON "rent_agreements"  ("property_address") `);
        await queryRunner.query(`ALTER TABLE "rent_agreements" ADD CONSTRAINT "FK_f565e6e231613251163597b7259" FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rent_agreements" DROP CONSTRAINT "FK_f565e6e231613251163597b7259"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8daa9146815767a728cf1719ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63d54af7d8ed1b94ffdaca1903"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8a6c46e4e1b07f02998684a67"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_731f7f347d9011b3f2a4a881e9"`);
        await queryRunner.query(`DROP TABLE "rent_agreements"`);
        await queryRunner.query(`DROP TYPE "public"."rent_agreements_status_enum"`);
    }

}