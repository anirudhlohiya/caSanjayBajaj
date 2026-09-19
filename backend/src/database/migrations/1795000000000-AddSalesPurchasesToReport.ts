import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesPurchasesToReport1795000000000 implements MigrationInterface {
  name = 'AddSalesPurchasesToReport1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" ADD "sales" numeric(12,2)`);
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "purchases" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "purchases"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "sales"`);
  }
}
