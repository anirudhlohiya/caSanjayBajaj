import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRentAgreementSoftDelete1792000000003 implements MigrationInterface {
  name = 'AddRentAgreementSoftDelete1792000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_agreements" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_agreements" DROP COLUMN "deleted_at"`,
    );
  }
}
