import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReportMetrics1789410548038 implements MigrationInterface {
    name = 'AddReportMetrics1789410548038'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "email_suppressed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reports" ADD "total_liability" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "reports" ADD "itc_claimed" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "reports" ADD "net_payable" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "rent_agreements" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rent_agreements" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "net_payable"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "itc_claimed"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "total_liability"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_suppressed_at"`);
    }

}
