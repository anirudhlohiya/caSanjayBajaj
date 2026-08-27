import { MigrationInterface, QueryRunner } from "typeorm";

export class WidenDevicePushToken1787900000000 implements MigrationInterface {
    name = 'WidenDevicePushToken1787900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "device_tokens" ALTER COLUMN "push_token" TYPE text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "device_tokens" ALTER COLUMN "push_token" TYPE character varying(500)`);
    }
}
