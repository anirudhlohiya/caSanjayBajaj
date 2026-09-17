import { MigrationInterface, QueryRunner } from "typeorm";

export class AddComplianceTasks1789644651216 implements MigrationInterface {
    name = 'AddComplianceTasks1789644651216'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."compliance_tasks_category_enum" AS ENUM('gstr_1', 'sales_bills', 'purchase_bills', 'iff', 'gstr_3b', 'gst_payment')`);
        await queryRunner.query(`CREATE TYPE "public"."compliance_tasks_status_enum" AS ENUM('pending', 'uploaded', 'completed')`);
        await queryRunner.query(`CREATE TABLE "compliance_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "filing_period_id" uuid NOT NULL, "category" "public"."compliance_tasks_category_enum" NOT NULL, "status" "public"."compliance_tasks_status_enum" NOT NULL DEFAULT 'pending', "due_date" TIMESTAMP WITH TIME ZONE, "amount" numeric(12,2), "paid_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_204138d089f35800efce2207a5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_16e8d0d468d6bdcdc488e1e36f" ON "compliance_tasks"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6c0e018fb1bbcdc4106014a22" ON "compliance_tasks"  ("user_id", "filing_period_id") `);
        await queryRunner.query(`ALTER TABLE "compliance_tasks" ADD CONSTRAINT "FK_16e8d0d468d6bdcdc488e1e36f6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "compliance_tasks" ADD CONSTRAINT "FK_455ebcefeab113c7a05c61c3c47" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "compliance_tasks" DROP CONSTRAINT "FK_455ebcefeab113c7a05c61c3c47"`);
        await queryRunner.query(`ALTER TABLE "compliance_tasks" DROP CONSTRAINT "FK_16e8d0d468d6bdcdc488e1e36f6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6c0e018fb1bbcdc4106014a22"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16e8d0d468d6bdcdc488e1e36f"`);
        await queryRunner.query(`DROP TABLE "compliance_tasks"`);
        await queryRunner.query(`DROP TYPE "public"."compliance_tasks_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."compliance_tasks_category_enum"`);
    }

}
