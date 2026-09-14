import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailSuppression1792000000004 implements MigrationInterface {
  name = 'AddEmailSuppression1792000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_suppressed_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email_suppressed_at"`,
    );
  }
}
