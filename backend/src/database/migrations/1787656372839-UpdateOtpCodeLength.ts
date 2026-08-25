import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateOtpCodeLength1787656372839 implements MigrationInterface {
    name = 'UpdateOtpCodeLength1787656372839'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "otp_verifications" ALTER COLUMN "otp_code" TYPE character varying(64)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "otp_verifications" ALTER COLUMN "otp_code" TYPE character varying(6)`);
    }
}
